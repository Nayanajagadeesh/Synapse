import OpenAI from "openai";
import type { ChatMessage, ChatOptions } from "./index";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export async function* openaiChatStream(
  messages: ChatMessage[],
  options: ChatOptions & { model: string }
): AsyncIterable<string> {
  const stream = await client().chat.completions.create(
    {
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens,
      stream: true,
    },
    { signal: options.signal }
  );

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export function openaiClient() {
  return client();
}
