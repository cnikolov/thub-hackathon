import { PDFParse } from 'pdf-parse';

const PDF_MIME = new Set(['application/pdf', 'application/x-pdf']);

export function isPdfMime(mime: string): boolean {
  return PDF_MIME.has(mime.toLowerCase());
}

export function isPlainTextMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return m === 'text/plain' || m === 'text/markdown' || m.startsWith('text/');
}

export async function extractTextFromCvBytes(buffer: Buffer, mime: string): Promise<string> {
  const m = mime.toLowerCase();
  if (isPlainTextMime(m)) {
    return buffer.toString('utf8');
  }
  if (isPdfMime(m)) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const textResult = await parser.getText();
      return textResult.text?.trim() ?? '';
    } finally {
      await parser.destroy();
    }
  }
  throw new Error('Unsupported file type. Use PDF or plain text.');
}
