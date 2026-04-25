/**
 * GET    /api/members?notebookId=:id     list members
 * POST   /api/members                    invite a user (by email) with a role
 * DELETE /api/members?notebookId=&userId  remove a member
 */

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
      .from("notebook_members")
      .select("user_id, role, profiles:user_id(email,display_name,avatar_url)")
      .eq("notebook_id", notebookId);
    if (error) throw error;
    return Response.json({ members: data });
  } catch (e) {
    return errorToResponse(e);
  }
}

const InviteSchema = z.object({
  notebookId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["viewer", "editor", "admin"]).default("viewer"),
});

export async function POST(req: Request) {
  try {
    const body = InviteSchema.parse(await req.json());
    const { userId } = await requireNotebookRole(body.notebookId, ["admin"]);
    const admin = supabaseAdmin();

    // Look up the invitee. We rely on `profiles.email` (populated on signup).
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", body.email)
      .maybeSingle();
    if (!profile) {
      return Response.json(
        { error: "User not found. They must sign up first; an email invite flow is a TODO." },
        { status: 404 }
      );
    }

    const { error } = await admin.from("notebook_members").upsert({
      notebook_id: body.notebookId,
      user_id: profile.id,
      role: body.role,
      invited_by: userId,
    });
    if (error) throw error;

    await admin.from("notifications").insert({
      user_id: profile.id,
      notebook_id: body.notebookId,
      kind: "mention",
      title: "You were added to a notebook",
      link: `/notebook/${body.notebookId}`,
    });

    return Response.json({ ok: true });
  } catch (e) {
    return errorToResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const notebookId = url.searchParams.get("notebookId");
    const userId = url.searchParams.get("userId");
    if (!notebookId || !userId) {
      return Response.json({ error: "notebookId & userId required" }, { status: 400 });
    }
    await requireNotebookRole(notebookId, ["admin"]);
    const supa = supabaseAdmin();
    const { error } = await supa
      .from("notebook_members")
      .delete()
      .eq("notebook_id", notebookId)
      .eq("user_id", userId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return errorToResponse(e);
  }
}
