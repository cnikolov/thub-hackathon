import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-embedding-001';

const apiKey = process.env.GEMINI_API_KEY ?? '';

function client() {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }
  return new GoogleGenAI({ apiKey });
}

function truncateForEmbed(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars);
}

export function hasEmbeddingConfig(): boolean {
  return Boolean(apiKey);
}

export async function embedDocument(text: string): Promise<Float32Array> {
  const t = truncateForEmbed(text, 20_000);
  if (!t) {
    throw new Error('Cannot embed empty text');
  }
  const ai = client();
  const response = await ai.models.embedContent({
    model: MODEL,
    contents: t,
    config: { taskType: 'RETRIEVAL_DOCUMENT' },
  });
  const emb = response.embeddings?.[0];
  const values = emb?.values;
  if (!values?.length) {
    throw new Error('No embedding returned from Gemini');
  }
  return Float32Array.from(values);
}

export async function embedQuery(text: string): Promise<Float32Array> {
  const t = truncateForEmbed(text, 2000);
  if (!t) {
    throw new Error('Cannot embed empty query');
  }
  const ai = client();
  const response = await ai.models.embedContent({
    model: MODEL,
    contents: t,
    config: { taskType: 'RETRIEVAL_QUERY' },
  });
  const emb = response.embeddings?.[0];
  const values = emb?.values;
  if (!values?.length) {
    throw new Error('No query embedding returned from Gemini');
  }
  return Float32Array.from(values);
}

export function float32ToBuffer(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

export function bufferToFloat32(buf: Buffer | null | undefined): Float32Array | null {
  if (!buf || buf.length < 8) return null;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d > 0 ? dot / d : 0;
}

/** Best similarity when comparing one query vector to two optional document vectors (CV vs interview notes). */
export function maxSimilarityToQuery(
  query: Float32Array,
  cv: Float32Array | null,
  notes: Float32Array | null,
): number {
  let best = 0;
  if (cv) best = Math.max(best, cosineSimilarity(query, cv));
  if (notes) best = Math.max(best, cosineSimilarity(query, notes));
  return best;
}
