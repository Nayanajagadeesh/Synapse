/**
 * Provider-agnostic LLM interface.
 *
 * Switch providers via the `LLM_PROVIDER` env var (`openai` | `anthropic` | `groq`)
 * without changing call sites. Every adapter implements the same `chatStream`
 * contract: an async iterable that yields incremental text chunks.
 *
 * Embeddings live in ./embeddings.ts because the providers diverge there
 * (Anthropic has no first-party embeddings API as of 2026).
 */

import { openaiChatStream } from "./openai";
import { anthropicChatStream } from "./anthropic";
import { groqChatStream } from "./groq";

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatOptions {
  /** Override the configured chat model for this call. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Abort the in-flight request — pass an AbortSignal from the framework. */
  signal?: AbortSignal;
}

export interface ChatProvider {
  /** Streaming chat completion. Yields raw text deltas. */
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string>;
}

const PROVIDER = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
const DEFAULT_MODEL = process.env.LLM_CHAT_MODEL ?? defaultModelFor(PROVIDER);

function defaultModelFor(provider: string): string {
  switch (provider) {
    case "anthropic":
      return "claude-sonnet-4-6";
    case "groq":
      return "llama-3.3-70b-versatile";
    case "openai":
    default:
      return "gpt-4o-mini";
  }
}

/** Get the active provider (memoised on first call). */
let _provider: ChatProvider | null = null;
export function getChatProvider(): ChatProvider {
  if (_provider) return _provider;
  switch (PROVIDER) {
    case "anthropic":
      _provider = { chatStream: (m, o) => anthropicChatStream(m, { model: DEFAULT_MODEL, ...o }) };
      break;
    case "groq":
      _provider = { chatStream: (m, o) => groqChatStream(m, { model: DEFAULT_MODEL, ...o }) };
      break;
    case "openai":
    default:
      _provider = { chatStream: (m, o) => openaiChatStream(m, { model: DEFAULT_MODEL, ...o }) };
  }
  return _provider;
}

/** Convenience: collect a streaming response into a single string. */
export async function chatComplete(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<string> {
  const provider = getChatProvider();
  let out = "";
  for await (const delta of provider.chatStream(messages, options)) out += delta;
  return out;
}

/** Convenience: stream chunks into a Web ReadableStream of UTF-8 bytes. */
export function chatStreamToResponse(
  messages: ChatMessage[],
  options?: ChatOptions
): ReadableStream<Uint8Array> {
  const provider = getChatProvider();
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of provider.chatStream(messages, options)) {
          controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

export { DEFAULT_MODEL, PROVIDER as ACTIVE_PROVIDER };
