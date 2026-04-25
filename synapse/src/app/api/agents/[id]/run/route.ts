/**
 * POST /api/agents/:id/run
 *
 * Triggers an agent on demand. The agent's `instructions` are run as a research
 * task: the model picks up to 3 search queries, retrieval gathers chunks across
 * the notebook, the model synthesises findings, and we persist them as an
 * "insight" note + a notification.
 *
 * For schedule-driven runs, n8n posts to /api/webhooks/n8n which ultimately
 * calls into this same code path.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { errorToResponse, requireNotebookRole } from "@/lib/auth";
import { chatComplete } from "@/lib/llm";
import { retrieve } from "@/lib/rag/retrieve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Ctx { params: { id: string } }

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const supa = supabaseAdmin();
    const { data: agent, error } = await supa
      .from("agents")
      .select("*")
      .eq("id", params.id)
      .single();
    if (error || !agent) return Response.json({ error: "Agent not found" }, { status: 404 });
    const { userId } = await requireNotebookRole(agent.notebook_id, ["editor", "admin"]);

    await supa.from("agents").update({ status: "running", last_error: null }).eq("id", agent.id);

    try {
      // 1. Ask the model to derive search queries from the agent's instructions
      const queriesRaw = await chatComplete([
        { role: "system", content: "You translate research goals into 1-3 short keyword queries. Return one per line, no bullets." },
        { role: "user", content: agent.instructions },
      ], { temperature: 0.2, maxTokens: 200 });
      const queries = queriesRaw
        .split("\n")
        .map((q) => q.trim().replace(/^[-*\d.\s)]+/, ""))
        .filter(Boolean)
        .slice(0, 3);

      // 2. Retrieve relevant chunks across the notebook for each query
      const seen = new Set<string>();
      const all: string[] = [];
      for (const q of queries.length ? queries : [agent.instructions]) {
        const chunks = await retrieve(q, { notebookId: agent.notebook_id, k: 6 });
        for (const c of chunks) {
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          all.push(`(${c.source_title ?? "source"}) ${c.content}`);
        }
      }

      // 3. Synthesise findings
      const findings = await chatComplete([
        { role: "system", content: "You produce concise daily research briefings. Use markdown with bullets. Cite source titles in parens." },
        {
          role: "user",
          content:
            `Agent goal: ${agent.instructions}\n\n` +
            `Source excerpts:\n${all.slice(0, 30).join("\n---\n").slice(0, 14000)}\n\n` +
            `Write a briefing with: 1) headline takeaway, 2) 3-6 bullet findings, 3) 1-2 follow-up questions.`,
        },
      ], { temperature: 0.4, maxTokens: 1200 });

      // 4. Persist as an insight note + a notification for every member
      await supa.from("notes").insert({
        notebook_id: agent.notebook_id,
        kind: "insight",
        title: `Agent run – ${agent.name}`,
        content: findings,
        metadata: { agent_id: agent.id },
      });

      const { data: members } = await supa
        .from("notebook_members")
        .select("user_id")
        .eq("notebook_id", agent.notebook_id);
      const recipients = new Set([userId, ...(members ?? []).map((m) => m.user_id)]);
      if (recipients.size) {
        await supa.from("notifications").insert(
          [...recipients].map((uid) => ({
            user_id: uid,
            notebook_id: agent.notebook_id,
            kind: "agent_done",
            title: `${agent.name} finished`,
            body: findings.slice(0, 240),
            link: `/notebook/${agent.notebook_id}/notes`,
          }))
        );
      }

      await supa
        .from("agents")
        .update({ status: "idle", last_run_at: new Date().toISOString() })
        .eq("id", agent.id);

      return Response.json({ ok: true, findings });
    } catch (err: any) {
      await supa
        .from("agents")
        .update({ status: "error", last_error: err?.message ?? String(err) })
        .eq("id", agent.id);
      throw err;
    }
  } catch (e) {
    return errorToResponse(e);
  }
}
