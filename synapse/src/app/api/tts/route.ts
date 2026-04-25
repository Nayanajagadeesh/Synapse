/** POST /api/tts  { text, voice? } → MP3 audio */

import { z } from "zod";
import { synthesize } from "@/lib/tts";
import { errorToResponse, requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  text: z.string().min(1).max(8000),
  voice: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await requireUser();
    const { text, voice } = Schema.parse(await req.json());
    const out = await synthesize(text, { voice });
    if (!out) {
      return Response.json({ error: "TTS provider not configured" }, { status: 503 });
    }
    return new Response(out.data, {
      headers: { "Content-Type": out.mime, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorToResponse(e);
  }
}
