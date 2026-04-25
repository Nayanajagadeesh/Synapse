/**
 * DOCX extraction via `mammoth`. Returns plain text (no styling).
 */

import mammoth from "mammoth";

export async function extractFromDocx(buffer: ArrayBuffer): Promise<{
  text: string;
  metadata: Record<string, unknown>;
}> {
  const { value, messages } = await mammoth.extractRawText({
    buffer: Buffer.from(buffer),
  });
  return {
    text: (value ?? "").trim(),
    metadata: {
      warnings: messages.map((m) => m.message),
    },
  };
}
