/**
 * Source ingestion pipeline.
 *
 * Given a `source` row that already exists in the DB, this:
 *   1. Pulls raw text via the appropriate adapter (PDF/DOCX/URL/YouTube/RSS)
 *   2. Chunks it
 *   3. Embeds chunks in batches
 *   4. Inserts them into `chunks`
 *   5. Marks the source as `ready` (or `error`) and kicks off summary generation
 *
 * Designed to run inside an API route so it shares the request's auth context.
 * Long ingestions can be moved to a queue (e.g. Inngest) without changing this
 * function's shape.
 */

import { chunkText } from "./chunk";
import { embedMany } from "@/lib/llm/embeddings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractFromPdf } from "@/lib/ingest/pdf";
import { extractFromDocx } from "@/lib/ingest/docx";
import { extractFromUrl } from "@/lib/ingest/url";
import { extractFromYouTube } from "@/lib/ingest/youtube";
import { generateSummary } from "@/lib/insights";

export interface IngestArgs {
  sourceId: string;
}

export async function ingestSource({ sourceId }: IngestArgs): Promise<void> {
  const supa = supabaseAdmin();

  const { data: source, error } = await supa
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (error || !source) throw error ?? new Error("Source not found");

  await supa.from("sources").update({ status: "processing", error: null }).eq("id", sourceId);

  try {
    // 1. Pull text
    let text = "";
    let metadata: Record<string, unknown> = {};
    switch (source.kind) {
      case "pdf": {
        const file = await downloadFromStorage(source.storage_path);
        const r = await extractFromPdf(file);
        text = r.text;
        metadata = r.metadata;
        break;
      }
      case "docx": {
        const file = await downloadFromStorage(source.storage_path);
        const r = await extractFromDocx(file);
        text = r.text;
        metadata = r.metadata;
        break;
      }
      case "txt": {
        const file = await downloadFromStorage(source.storage_path);
        text = new TextDecoder().decode(file);
        break;
      }
      case "url": {
        const r = await extractFromUrl(source.url!);
        text = r.text;
        metadata = r.metadata;
        break;
      }
      case "youtube": {
        const r = await extractFromYouTube(source.url!);
        text = r.text;
        metadata = r.metadata;
        break;
      }
      case "rss": {
        // RSS items are ingested individually; here we just stash the feed metadata.
        text = source.metadata?.feedDescription ?? source.title;
        break;
      }
    }

    if (!text || text.trim().length < 20) {
      throw new Error("No extractable text found in source");
    }

    // 2. Chunk
    const chunks = chunkText(text);

    // 3. Embed in batches (handled inside embedMany)
    const embeddings = await embedMany(chunks.map((c) => c.content));

    // 4. Insert (replacing any prior chunks for this source)
    await supa.from("chunks").delete().eq("source_id", sourceId);
    const rows = chunks.map((c, i) => ({
      source_id: sourceId,
      notebook_id: source.notebook_id,
      ord: c.ord,
      content: c.content,
      embedding: embeddings[i],
      metadata: {},
    }));
    if (rows.length) {
      // Insert in moderate batches to avoid the 1MB request limit
      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const { error: e } = await supa.from("chunks").insert(slice);
        if (e) throw e;
      }
    }

    await supa
      .from("sources")
      .update({
        status: "ready",
        metadata: { ...source.metadata, ...metadata },
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", sourceId);

    // 5. Kick off summary in the background — don't fail ingestion if it errors
    generateSummary({ sourceId }).catch((err) => {
      console.error("[ingest] summary failed", err);
    });
  } catch (err: any) {
    console.error("[ingest] failed", err);
    await supa
      .from("sources")
      .update({ status: "error", error: err?.message ?? String(err) })
      .eq("id", sourceId);
    throw err;
  }
}

async function downloadFromStorage(path: string | null): Promise<ArrayBuffer> {
  if (!path) throw new Error("No storage_path on source");
  const supa = supabaseAdmin();
  const { data, error } = await supa.storage.from("sources").download(path);
  if (error || !data) throw error ?? new Error("Failed to download from storage");
  return await data.arrayBuffer();
}
