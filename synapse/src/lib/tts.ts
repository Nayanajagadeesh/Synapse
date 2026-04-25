/**
 * Text-to-speech helper. Currently wraps OpenAI's `tts-1` model; the result
 * is an MP3 byte stream returned to the caller. A no-op fallback ships when
 * no TTS provider is configured so the rest of the app keeps working.
 */

import { openaiClient } from "@/lib/llm/openai";

export interface TtsOptions {
  voice?: string; // e.g. "alloy", "shimmer", "nova"
  model?: string;
  speed?: number;
}

export async function synthesize(
  text: string,
  options: TtsOptions = {}
): Promise<{ data: Uint8Array; mime: string } | null> {
  const provider = (process.env.TTS_PROVIDER ?? "openai").toLowerCase();
  if (provider !== "openai") return null;
  if (!process.env.OPENAI_API_KEY) return null;

  const model = options.model ?? process.env.TTS_MODEL ?? "tts-1";
  const voice = options.voice ?? process.env.TTS_VOICE ?? "alloy";

  const r = await openaiClient().audio.speech.create({
    model,
    voice: voice as any,
    input: text.slice(0, 4000), // OpenAI's per-call cap
    speed: options.speed,
  });
  const buf = Buffer.from(await r.arrayBuffer());
  return { data: new Uint8Array(buf), mime: "audio/mpeg" };
}
