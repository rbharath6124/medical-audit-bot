/**
 * No client-side PDF parsing needed anymore.
 *
 * Gemini reads PDFs natively (multimodal). We simply read the file bytes and
 * base64-encode them in the browser, then send them straight to Gemini as
 * inlineData. This is far more reliable than pdf.js in sandboxed/single-file
 * environments AND more accurate — Gemini sees the real layout, tables and
 * quantities, not just stripped text.
 */

export interface FilePayload {
  base64: string;
  mimeType: string;
  isPdf: boolean;
  text?: string; // for plain-text uploads
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return btoa(binary);
}

export async function readFilePayload(file: File): Promise<FilePayload> {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    const buf = await file.arrayBuffer();
    if (buf.byteLength > 18 * 1024 * 1024) {
      throw new Error("PDF too large (>18MB). Please split it into smaller files.");
    }
    return {
      base64: arrayBufferToBase64(buf),
      mimeType: "application/pdf",
      isPdf: true,
    };
  }

  // Plain text / other — read as text
  const text = await file.text();
  return { base64: "", mimeType: "text/plain", isPdf: false, text };
}
