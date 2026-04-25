/**
 * Text chunker tuned for RAG. Splits long text into ~`size` tokens worth of
 * characters with `overlap` characters of overlap, preferring sentence/paragraph
 * boundaries so chunks don't end mid-thought.
 *
 * We use character counts (≈4 chars per English token) rather than a real
 * tokenizer to stay zero-dependency in the runtime.
 */

export interface ChunkOptions {
  /** Target characters per chunk. ~1500 ≈ ~375 tokens for English. */
  size?: number;
  /** Overlap in characters between consecutive chunks. */
  overlap?: number;
}

export interface Chunk {
  ord: number;
  content: string;
}

const DEFAULT_SIZE = 1500;
const DEFAULT_OVERLAP = 200;

const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z0-9])/g;
const PARA_BREAK = /\n{2,}/g;

export function chunkText(input: string, opts: ChunkOptions = {}): Chunk[] {
  const size = opts.size ?? DEFAULT_SIZE;
  const overlap = opts.overlap ?? DEFAULT_OVERLAP;
  const text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  if (text.length <= size) return [{ ord: 0, content: text }];

  // First split by paragraphs, then merge small ones, then sentence-split any oversize paragraph.
  const paragraphs = text.split(PARA_BREAK);
  const sentences: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= size) {
      sentences.push(p);
    } else {
      sentences.push(...p.split(SENTENCE_BREAK));
    }
  }

  const chunks: Chunk[] = [];
  let current = "";
  let ord = 0;
  for (const s of sentences) {
    const s2 = s.trim();
    if (!s2) continue;
    if (current.length + s2.length + 1 <= size) {
      current = current ? `${current} ${s2}` : s2;
    } else {
      if (current) chunks.push({ ord: ord++, content: current });
      // start the next chunk with a tail of the previous one for context overlap
      const tail = current.slice(-overlap);
      current = tail ? `${tail} ${s2}` : s2;
    }
  }
  if (current) chunks.push({ ord: ord++, content: current });
  return chunks;
}
