import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ChatOptions } from "./index";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Anthropic separates the system prompt from the messages array, so we coalesce
 * any leading system messages into one `system` string before calling.
 */
export async function* anthropicChatStream(
  messages: ChatMessage[],
  options: ChatOptions & { model: string }
): AsyncIterable<string> {
  const systemParts: string[] = [];
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else turns.push({ role: m.role, content: m.content });
  }

  const stream = client().messages.stream(
    {
      model: options.model,
      system: systemParts.join("\n\n") || undefined,
      messages: turns,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.2,
    },
    { signal: options.signal }
  );

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
