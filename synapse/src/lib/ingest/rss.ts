/**
 * RSS feed adapter. Subscribing to a feed creates ONE `sources` row with
 * `kind=rss` for the feed itself, and CHILD url-sources for each item the
 * scheduler pulls in.
 */

import Parser from "rss-parser";
import { supabaseAdmin } from "@/lib/supabase/admin";

const parser = new Parser({ timeout: 15_000 });

export interface RssItemSummary {
  title: string;
  link?: string;
  pubDate?: string;
}

export async function readFeed(feedUrl: string): Promise<{
  feed: { title: string; description?: string };
  items: RssItemSummary[];
}> {
  const f = await parser.parseURL(feedUrl);
  return {
    feed: { title: f.title ?? feedUrl, description: f.description },
    items: (f.items ?? []).map((i) => ({
      title: i.title ?? "(untitled)",
      link: i.link,
      pubDate: i.pubDate,
    })),
  };
}

/**
 * Pull new items from the feed and create `kind=url` child sources for any
 * we haven't seen before. Returns the number of new items added.
 */
export async function syncFeed(feedSourceId: string): Promise<number> {
  const supa = supabaseAdmin();
  const { data: feedSource, error } = await supa
    .from("sources")
    .select("*")
    .eq("id", feedSourceId)
    .single();
  if (error || !feedSource) throw error ?? new Error("Feed not found");
  if (feedSource.kind !== "rss") throw new Error("Source is not an RSS feed");

  const { items } = await readFeed(feedSource.url);

  // Find URLs we already ingested under this feed.
  const { data: existing } = await supa
    .from("sources")
    .select("url")
    .eq("notebook_id", feedSource.notebook_id)
    .eq("kind", "url");
  const seen = new Set((existing ?? []).map((s: { url: string }) => s.url));

  const newRows = items
    .filter((i) => i.link && !seen.has(i.link))
    .map((i) => ({
      notebook_id: feedSource.notebook_id,
      kind: "url" as const,
      title: i.title,
      url: i.link!,
      status: "pending" as const,
      metadata: { feedSourceId, pubDate: i.pubDate },
      created_by: feedSource.created_by,
    }));

  if (!newRows.length) {
    await supa
      .from("sources")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", feedSourceId);
    return 0;
  }

  const { data: inserted, error: e2 } = await supa
    .from("sources")
    .insert(newRows)
    .select("id");
  if (e2) throw e2;

  await supa
    .from("sources")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", feedSourceId);

  // Kick off ingestion of each new article in parallel (caller can also do this).
  const { ingestSource } = await import("@/lib/rag/ingest");
  await Promise.allSettled(
    (inserted ?? []).map((s: { id: string }) => ingestSource({ sourceId: s.id }))
  );

  return newRows.length;
}
