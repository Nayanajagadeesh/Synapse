/**
 * Retrieval: turn a query string into the top-K most relevant chunks for a
 * notebook, joined with their source metadata so we can show citations.
 */

import { embed } from "@/lib/llm/embeddings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RetrievedChunk } from "./prompt";

export interface RetrieveOptions {
  notebookId?: string | null; // null = cross-notebook (still filtered by RLS in the RPC)
  k?: number;
  /** Drop chunks below this cosine similarity. */
  minScore?: number;
}

export async function retrieve(
  query: string,
  opts: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const k = opts.k ?? 8;
  const minScore = opts.minScore ?? 0.2;

  const queryEmbedding = await embed(query);
  const supa = supabaseAdmin();

  // Use the SQL RPC defined in supabase/schema.sql.
  const { data, error } = await supa.rpc("match_chunks", {
    query_embedding: queryEmbedding as unknown as number[],
    match_count: k,
    filter_notebook: opts.notebookId ?? null,
  });
  if (error) throw error;

  const rows = (data ?? []).filter((r: any) => r.similarity >= minScore);

  // Hydrate source titles in one batch.
  const sourceIds = [...new Set(rows.map((r: any) => r.source_id))];
  let sourceMap = new Map<string, { title: string; kind: string }>();
  if (sourceIds.length) {
    const { data: srcs } = await supa
      .from("sources")
      .select("id,title,kind")
      .in("id", sourceIds);
    for (const s of srcs ?? []) sourceMap.set(s.id, { title: s.title, kind: s.kind });
  }

  return rows.map((r: any) => ({
    id: r.id,
    source_id: r.source_id,
    content: r.content,
    ord: r.ord,
    similarity: r.similarity,
    source_title: sourceMap.get(r.source_id)?.title,
    source_kind: sourceMap.get(r.source_id)?.kind,
  }));
}
