/** POST /api/sources/youtube   { notebookId, url, title? } */

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ingestSource } from "@/lib/rag/ingest";
import { errorToResponse, requireNotebookRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Schema = z.object({
  notebookId: z.string().uuid(),
  url: z.string().url(),
  title: z.string().max(160).optional(),
});

export async function POST(req: Request) {
  try {
    const body = Schema.parse(await req.json());
    const { userId } = await requireNotebookRole(body.notebookId, ["editor", "admin"]);

    const supa = supabaseAdmin();
    const { data: source, error } = await supa
      .from("sources")
      .insert({
        notebook_id: body.notebookId,
        kind: "youtube",
        title: body.title || body.url,
        url: body.url,
        status: "pending",
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    ingestSource({ sourceId: source.id }).catch(console.error);
    return Response.json({ source }, { status: 202 });
  } catch (e) {
    return errorToResponse(e);
  }
}
