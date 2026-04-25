/**
 * GET  /api/notebooks         list every notebook the user owns or is a member of
 * POST /api/notebooks         create a new notebook (the creator becomes its owner)
 */

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser, errorToResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const supa = createSupabaseServerClient();
    const { data, error } = await supa
      .from("notebooks")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return Response.json({ notebooks: data });
  } catch (e) {
    return errorToResponse(e);
  }
}

const CreateSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  emoji: z.string().max(8).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = CreateSchema.parse(await req.json());
    const supa = createSupabaseServerClient();
    const { data, error } = await supa
      .from("notebooks")
      .insert({ owner_id: user.id, ...body })
      .select("*")
      .single();
    if (error) throw error;
    return Response.json({ notebook: data });
  } catch (e) {
    return errorToResponse(e);
  }
}
