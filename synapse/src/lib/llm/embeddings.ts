/**
 * Embeddings adapter. We always go through an OpenAI-compatible endpoint
 * because Anthropic doesn't ship embeddings — but you can point this at
 * any OpenAI-compatible server (e.g. self-hosted bge, fastembed) by setting
 * `EMBEDDINGS_PROVIDER=openai-compatible` and `OPENAI_BASE_URL`.
 */

import OpenAI from "openai";

const MODEL = process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small";
const DIMENSIONS = Number(process.env.EMBEDDINGS_DIMENSIONS ?? 1536);

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for embeddings");
    }
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }
  return _client;
}

/** Embed a single string. */
export async function embed(text: string): Promise<number[]> {
  const [vec] = await embedMany([text]);
  return vec;
}

/** Batch-embed many strings. Splits into chunks to stay under provider limits. */
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  const BATCH = 96; // OpenAI accepts up to 2048, but smaller batches are kinder on the wire
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const resp = await client().embeddings.create({
      model: MODEL,
      input: batch,
      // The 3-* models support a `dimensions` argument; older ones ignore it.
      ...(MODEL.startsWith("text-embedding-3") ? { dimensions: DIMENSIONS } : {}),
    });
    for (const item of resp.data) out.push(item.embedding as number[]);
  }
  return out;
}

export const EMBEDDING_DIMENSIONS = DIMENSIONS;
export const EMBEDDING_MODEL = MODEL;
