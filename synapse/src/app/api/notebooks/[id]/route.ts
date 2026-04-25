/**
 * GET    /api/notebooks/:id    fetch one notebook (with member list)
 * PATCH  /api/notebooks/:id    rename / change emoji / description
 * DELETE /api/notebooks/:id    delete (owner only)
 */

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorToResponse, requireNotebookRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Ctx { params: { id: string } }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireNotebookRole(params.id, ["viewer", "editor", "admin"]);
    const supa = createSupabaseServerClient();
    const [{ data: notebook }, { data: members }] = await Promise.all([
      supa.from("notebooks").select("*").eq("id", params.id).single(),
      supa
        .from("notebook_members")
        .select("user_id,role,profiles:user_id(display_name,avatar_url,email)")
        .eq("notebook_id", params.id),
    ]);
    return Response.json({ notebook, members });
  } catch (e) {
    return errorToResponse(e);
  }
}

const PatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  emoji: z.string().max(8).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireNotebookRole(params.id, ["editor", "admin"]);
    const patch = PatchSchema.parse(await req.json());
    const supa = createSupabaseServerClient();
    const { data, error } = await supa
      .from("notebooks")
      .update(patch)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw error;
    return Response.json({ notebook: data });
  } catch (e) {
    return errorToResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireNotebookRole(params.id, ["admin"]);
    const supa = createSupabaseServerClient();
    const { error } = await supa.from("notebooks").delete().eq("id", params.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return errorToResponse(e);
  }
}
