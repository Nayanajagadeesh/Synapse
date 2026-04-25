/** GET /api/notes?notebookId=:id   list notes for a notebook */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorToResponse, requireNotebookRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const notebookId = url.searchParams.get("notebookId");
    if (!notebookId) return Response.json({ error: "notebookId required" }, { status: 400 });
    await requireNotebookRole(notebookId, ["viewer", "editor", "admin"]);
    const supa = createSupabaseServerClient();
    const { data, error } = await supa
      .from("notes")
      .select("*")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ notes: data });
  } catch (e) {
    return errorToResponse(e);
  }
}
