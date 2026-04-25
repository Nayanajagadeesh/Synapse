/**
 * GET /api/sources?notebookId=:id     list sources in a notebook
 * DELETE /api/sources?id=:id          delete a source (cascades to chunks)
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorToResponse, requireNotebookRole, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const notebookId = url.searchParams.get("notebookId");
    if (!notebookId) return Response.json({ error: "notebookId required" }, { status: 400 });
    await requireNotebookRole(notebookId, ["viewer", "editor", "admin"]);
    const supa = createSupabaseServerClient();
    const { data, error } = await supa
      .from("sources")
      .select("*")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ sources: data });
  } catch (e) {
    return errorToResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const supa = createSupabaseServerClient();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const { data: src } = await supa.from("sources").select("notebook_id").eq("id", id).single();
    if (!src) return Response.json({ error: "Not found" }, { status: 404 });
    await requireNotebookRole(src.notebook_id, ["editor", "admin"]);

    const { error } = await supa.from("sources").delete().eq("id", id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return errorToResponse(e);
  }
}
