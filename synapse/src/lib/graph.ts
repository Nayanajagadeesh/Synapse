/**
 * Knowledge-graph builder.
 *
 * Strategy (intentionally simple — see README's roadmap for upgrades):
 *   - Each source becomes a node.
 *   - We extract candidate "concepts" from each source's summary by lowercasing,
 *     filtering stopwords, and keeping the top capitalised noun phrases.
 *   - Two sources share an edge if they reference at least one common concept;
 *     edge weight = # shared concepts.
 *   - Concept nodes are emitted as a second layer for visual richness.
 *
 * For production: replace the regex extractor with NER (e.g. spaCy via an API,
 * or a small model call) and you'll get dramatically better edges.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface GraphNode {
  id: string;
  label: string;
  kind: "source" | "concept";
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","in","on","for","to","with","as","at","by",
  "from","that","this","these","those","is","are","was","were","be","been","being",
  "it","its","their","there","they","we","you","i","he","she","them","his","her",
]);

function extractConcepts(text: string, max = 8): string[] {
  // Capture multi-word capitalised phrases (a crude proxy for entities)
  const phrases = text.match(/\b[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,3}\b/g) ?? [];
  const counts = new Map<string, number>();
  for (const p of phrases) {
    const norm = p.trim();
    if (norm.length < 4) continue;
    const lower = norm.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    counts.set(norm, (counts.get(norm) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

export async function buildGraph(notebookId: string): Promise<GraphData> {
  const supa = supabaseAdmin();
  const { data: notes } = await supa
    .from("notes")
    .select("source_id,content")
    .eq("notebook_id", notebookId)
    .eq("kind", "summary");
  const { data: sources } = await supa
    .from("sources")
    .select("id,title")
    .eq("notebook_id", notebookId);

  const sourceMap = new Map((sources ?? []).map((s) => [s.id, s.title] as const));
  const conceptsBySource = new Map<string, string[]>();
  for (const n of notes ?? []) {
    if (!n.source_id) continue;
    conceptsBySource.set(n.source_id, extractConcepts(n.content));
  }

  // Build the concept index
  const conceptToSources = new Map<string, Set<string>>();
  for (const [sid, concepts] of conceptsBySource) {
    for (const c of concepts) {
      if (!conceptToSources.has(c)) conceptToSources.set(c, new Set());
      conceptToSources.get(c)!.add(sid);
    }
  }

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  for (const [sid, title] of sourceMap) {
    nodes.push({ id: `s:${sid}`, label: title, kind: "source" });
  }
  for (const c of conceptToSources.keys()) {
    nodes.push({ id: `c:${c}`, label: c, kind: "concept" });
  }

  // source ↔ concept edges
  for (const [c, sids] of conceptToSources) {
    for (const sid of sids) {
      links.push({ source: `s:${sid}`, target: `c:${c}`, weight: 1 });
    }
  }

  // source ↔ source co-occurrence (concept count)
  const sourceIds = [...sourceMap.keys()];
  for (let i = 0; i < sourceIds.length; i++) {
    for (let j = i + 1; j < sourceIds.length; j++) {
      const a = new Set(conceptsBySource.get(sourceIds[i]) ?? []);
      const b = new Set(conceptsBySource.get(sourceIds[j]) ?? []);
      let shared = 0;
      a.forEach((x) => b.has(x) && shared++);
      if (shared > 0) {
        links.push({ source: `s:${sourceIds[i]}`, target: `s:${sourceIds[j]}`, weight: shared });
      }
    }
  }

  return { nodes, links };
}
