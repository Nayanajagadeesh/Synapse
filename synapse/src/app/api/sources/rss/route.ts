/** POST /api/sources/rss    { notebookId, url, refreshIntervalMinutes? } */

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readFeed, syncFeed } from "@/lib/ingest/rss";
import { errorToResponse, requireNotebookRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Schema = z.object({
  notebookId: z.string().uuid(),
  url: z.string().url(),
  refreshIntervalMinutes: z.number().int().min(30).max(60 * 24 * 7).default(60 * 6),
});

export async function POST(req: Request) {
  try {
    const body = Schema.parse(await req.json());
    const { userId } = await requireNotebookRole(body.notebookId, ["editor", "admin"]);

    // Validate the feed before persisting it
    const { feed } = await readFeed(body.url);

    const supa = supabaseAdmin();
    const { data: source, error } = await supa
      .from("sources")
      .insert({
        notebook_id: body.notebookId,
        kind: "rss",
        title: feed.title,
        url: body.url,
        status: "ready",
        refresh_interval_minutes: body.refreshIntervalMinutes,
        metadata: { feedDescription: feed.description },
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    // Pull initial items asynchronously
    syncFeed(source.id).catch(console.error);
    return Response.json({ source }, { status: 202 });
  } catch (e) {
    return errorToResponse(e);
  }
}
