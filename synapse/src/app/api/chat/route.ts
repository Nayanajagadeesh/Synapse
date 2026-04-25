/**
 * POST /api/chat
 * Body: { notebookId, message, mode?, history? }
 *
 * Streams the model's answer back as text/event-stream-style chunks (just plain
 * text for simplicity). The route:
 *   1. Persists the user's message
 *   2. Retrieves top-K chunks via pgvector
 *   3. Builds the prompt with citations
 *   4. Streams the answer to the client
 *   5. After streaming, persists the assistant message + extracted citations
 *
 * The streaming protocol: a 200 with `text/plain` and chunked transfer. The
 * client appends each chunk to the in-flight assistant bubble. A final line
 * `\n\n[[CITATIONS]]<json>` carries citations once the body finishes.
 */

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { errorToResponse, requireNotebookRole } from "@/lib/auth";
import { retrieve } from "@/lib/rag/retrieve";
import { buildMessages, extractCitations } from "@/lib/rag/prompt";
import { getChatProvider, type ChatMessage } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Schema = z.object({
  notebookId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  /** Optional system-style mode. Currently free-form, e.g. "ELI5", "Exam mode". */
  mode: z.string().max(80).optional(),
  /** Recent client-side history (capped server-side). */
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(40)
    .optional(),
  /** Cross-notebook search across all the user's notebooks. */
  crossNotebook: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const body = Schema.parse(await req.json());
    const { userId } = await requireNotebookRole(body.notebookId, ["viewer", "editor", "admin"]);

    const supa = supabaseAdmin();

    // 1. Persist user message
    await supa.from("messages").insert({
      notebook_id: body.notebookId,
      user_id: userId,
      role: "user",
      content: body.message,
    });

    // 2. Retrieve relevant chunks
    const retrieved = await retrieve(body.message, {
      notebookId: body.crossNotebook ? null : body.notebookId,
      k: 8,
    });

    // 3. Assemble prompt
    const history: ChatMessage[] = [
      ...(body.history ?? []),
      { role: "user", content: body.message },
    ];
    const messages = buildMessages(history, retrieved, body.mode);

    // 4. Stream answer
    const provider = getChatProvider();
    const encoder = new TextEncoder();
    let answer = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of provider.chatStream(messages, { temperature: 0.2 })) {
            answer += delta;
            controller.enqueue(encoder.encode(delta));
          }
          // 5. After full body, append citations as a sentinel line
          const citations = extractCitations(answer, retrieved);
          await supa.from("messages").insert({
            notebook_id: body.notebookId,
            role: "assistant",
            content: answer,
            citations,
          });
          const tail = `\n\n[[CITATIONS]]${JSON.stringify({
            citations,
            sources: retrieved.map((r, i) => ({
              tag: i + 1,
              source_id: r.source_id,
              title: r.source_title,
              kind: r.source_kind,
              snippet: r.content.slice(0, 280),
              ord: r.ord,
              similarity: r.similarity,
            })),
          })}`;
          controller.enqueue(encoder.encode(tail));
          controller.close();
        } catch (err) {
          console.error("[chat] stream error", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return errorToResponse(e);
  }
}
