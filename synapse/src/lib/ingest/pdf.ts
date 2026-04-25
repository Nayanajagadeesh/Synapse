/**
 * PDF text extraction. Uses `pdf-parse` (a thin wrapper around pdf.js).
 * For OCR'd-only PDFs you'd plug in Tesseract or a cloud OCR here.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse");

export async function extractFromPdf(buffer: ArrayBuffer): Promise<{
  text: string;
  metadata: Record<string, unknown>;
}> {
  const data = await pdfParse(Buffer.from(buffer));
  return {
    text: (data.text ?? "").trim(),
    metadata: {
      pages: data.numpages,
      info: data.info ?? {},
    },
  };
}
