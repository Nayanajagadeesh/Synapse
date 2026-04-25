import Groq from "groq-sdk";
import type { ChatMessage, ChatOptions } from "./index";

let _client: Groq | null = null;
function client(): Groq {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not set");
    }
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

/** Groq SDK is OpenAI-compatible, so the implementation mirrors openai.ts. */
export async function* groqChatStream(
  messages: ChatMessage[],
  options: ChatOptions & { model: string }
): AsyncIterable<string> {
  const stream = await client().chat.completions.create({
    model: options.model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens,
    stream: true,
  });

  for await (const chunk of stream as any) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta as string;
  }
}
