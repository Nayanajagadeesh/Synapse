/**
 * GET  /api/agents?notebookId=:id   list agents in a notebook
 * POST /api/agents                  create
 */

import { z } from "zod";
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
      .from("agents")
      .select("*")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ agents: data });
  } catch (e) {
    return errorToResponse(e);
  }
}

const CreateSchema = z.object({
  notebookId: z.string().uuid(),
  name: z.string().min(1).max(80),
  instructions: z.string().min(10).max(2000),
  schedule_cron: z.string().max(80).optional(),
  config: z.record(z.unknown()).default({}),
});

export async function POST(req: Request) {
  try {
    const body = CreateSchema.parse(await req.json());
    const { userId } = await requireNotebookRole(body.notebookId, ["editor", "admin"]);
    const supa = createSupabaseServerClient();
    const { data, error } = await supa
      .from("agents")
      .insert({
        notebook_id: body.notebookId,
        name: body.name,
        instructions: body.instructions,
        schedule_cron: body.schedule_cron,
        config: body.config,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return Response.json({ agent: data });
  } catch (e) {
    return errorToResponse(e);
  }
}
