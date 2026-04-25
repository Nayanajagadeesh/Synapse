/**
 * Auto-generated knowledge: summaries (multiple modes) and cross-document insights.
 *
 * `generateSummary` runs after each ingestion to give the user a "what's in this?"
 * blurb without hand-prompting. `generateInsights` runs across the whole notebook
 * to detect trends, contradictions, and surprising facts.
 */

import { chatComplete } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type NoteKind = Database["public"]["Enums"]["note_kind"];

const MODE_PROMPTS: Record<Exclude<NoteKind, "summary" | "insight">, string> = {
  outline:
    "Produce a structured outline of the source as nested markdown bullets, capturing every major section and the key supporting points.",
  eli5:
    "Explain the source as if to a curious 10-year-old. Plain words, short sentences, friendly tone.",
  exam:
    "Prepare exam-style study notes: definitions, theorems/claims, examples, and a Q&A section with 5 likely test questions.",
  research:
    "Provide a research-grade analysis: thesis, methodology, evidence, limitations, open questions, and how this fits into the wider literature.",
};

const MAX_CONTEXT_CHARS = 18_000;

async function loadSourceText(sourceId: string): Promise<{ title: string; text: string }> {
  const supa = supabaseAdmin();
  const [{ data: source }, { data: chunks }] = await Promise.all([
    supa.from("sources").select("title").eq("id", sourceId).single(),
    supa.from("chunks").select("content,ord").eq("source_id", sourceId).order("ord"),
  ]);
  if (!source) throw new Error("Source not found");
  const joined = (chunks ?? []).map((c) => c.content).join("\n\n").slice(0, MAX_CONTEXT_CHARS);
  return { title: source.title, text: joined };
}

export async function generateSummary({
  sourceId,
}: {
  sourceId: string;
}): Promise<string> {
  const supa = supabaseAdmin();
  const { title, text } = await loadSourceText(sourceId);
  if (!text) return "";

  const prompt = `Summarise the following source titled "${title}" in 4–6 sentences. Capture the thesis, key findings, and any surprising claims. Be concrete.\n\n${text}`;
  const summary = await chatComplete(
    [
      { role: "system", content: "You are a precise research assistant. Summarise faithfully." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3, maxTokens: 600 }
  );

  // Persist as a note row so the UI can display it.
  const { data: source } = await supa
    .from("sources")
    .select("notebook_id")
    .eq("id", sourceId)
    .single();
  if (!source) return summary;

  await supa.from("notes").insert({
    notebook_id: source.notebook_id,
    source_id: sourceId,
    kind: "summary",
    title: `Summary of ${title}`,
    content: summary,
  });
  return summary;
}

export async function generateModeNote({
  sourceId,
  mode,
}: {
  sourceId: string;
  mode: Exclude<NoteKind, "summary" | "insight">;
}): Promise<string> {
  const { title, text } = await loadSourceText(sourceId);
  const prompt = `${MODE_PROMPTS[mode]}\n\nSource title: ${title}\n\nContent:\n${text}`;
  const out = await chatComplete(
    [
      { role: "system", content: "Follow the requested format precisely. Use markdown." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3, maxTokens: 1500 }
  );

  const supa = supabaseAdmin();
  const { data: source } = await supa
    .from("sources")
    .select("notebook_id")
    .eq("id", sourceId)
    .single();
  if (source) {
    await supa.from("notes").insert({
      notebook_id: source.notebook_id,
      source_id: sourceId,
      kind: mode,
      title: `${mode} – ${title}`,
      content: out,
    });
  }
  return out;
}

/**
 * Cross-document insight generator. Pulls the summaries across a notebook and
 * asks the model to detect trends, contradictions, and key insights — returning
 * structured markdown with three sections.
 */
export async function generateInsights({
  notebookId,
}: {
  notebookId: string;
}): Promise<string> {
  const supa = supabaseAdmin();
  const { data: notes } = await supa
    .from("notes")
    .select("title,content,source_id")
    .eq("notebook_id", notebookId)
    .eq("kind", "summary")
    .order("created_at", { ascending: false })
    .limit(40);

  if (!notes?.length) {
    return "No source summaries available yet — add a few sources first.";
  }

  const corpus = notes
    .map((n, i) => `### Source ${i + 1}: ${n.title}\n${n.content}`)
    .join("\n\n")
    .slice(0, 20_000);

  const out = await chatComplete(
    [
      {
        role: "system",
        content:
          "You synthesise insights across many research summaries. Be honest when sources disagree. Cite sources by their titles in parentheses.",
      },
      {
        role: "user",
        content:
          `Below are summaries of sources in a research notebook. Produce three markdown sections:\n` +
          `1. **Trends** — what multiple sources agree on.\n` +
          `2. **Contradictions** — concrete disagreements between sources, naming both.\n` +
          `3. **Key insights** — non-obvious takeaways a researcher should not miss.\n\n` +
          corpus,
      },
    ],
    { temperature: 0.4, maxTokens: 1500 }
  );

  await supa.from("notes").insert({
    notebook_id: notebookId,
    kind: "insight",
    title: `Cross-document insights (${new Date().toLocaleDateString()})`,
    content: out,
  });
  return out;
}
