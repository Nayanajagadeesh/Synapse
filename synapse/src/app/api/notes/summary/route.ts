/** POST /api/notes/summary  { sourceId?, mode? }  — generate (or regenerate) a note */

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { errorToResponse, requireNotebookRole } from "@/lib/auth";
import { generateModeNote, generateSummary } from "@/lib/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Schema = z.object({
  sourceId: z.string().uuid(),
  mode: z.enum(["summary", "outline", "eli5", "exam", "research"]).default("summary"),
});

export async function POST(req: Request) {
  try {
    const { sourceId, mode } = Schema.parse(await req.json());
    const supa = supabaseAdmin();
    const { data: src } = await supa
      .from("sources")
      .select("notebook_id")
      .eq("id", sourceId)
      .single();
    if (!src) return Response.json({ error: "Source not found" }, { status: 404 });
    await requireNotebookRole(src.notebook_id, ["editor", "admin"]);

    const content =
      mode === "summary"
        ? await generateSummary({ sourceId })
        : await generateModeNote({ sourceId, mode });
    return Response.json({ content });
  } catch (e) {
    return errorToResponse(e);
  }
}
