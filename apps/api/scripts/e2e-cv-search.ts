/**
 * End-to-end: POST CSV.pdf to a candidate, then GET /candidates with keyword search for the embedded token.
 * Cleans up its own test data after running so dev.db stays clean.
 *
 * Run from apps/api: bun run scripts/e2e-cv-search.ts
 * Requires: dev.db with at least one project and one job (e.g. after db:seed).
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { candidates } from '../src/schema.ts';
import { app } from '../src/index.ts';
import { E2E_CSV_PDF_SEARCH_TOKEN } from './e2e-tokens.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cleanupDb = drizzle(new Database('dev.db'));

const idsToClean: number[] = [];

async function json(res: Response) {
  return JSON.parse(await res.text()) as { success?: boolean; error?: string; data?: unknown };
}

async function cleanup() {
  for (const id of idsToClean) {
    await cleanupDb.delete(candidates).where(eq(candidates.id, id));
  }
}

async function main() {
  const pdfPath = join(__dirname, '../test-fixtures/CSV.pdf');
  const file = Bun.file(pdfPath);
  if (!(await file.exists())) {
    console.error('Missing test-fixtures/CSV.pdf — run: bun run scripts/generate-csv-pdf.ts');
    process.exit(1);
  }
  const pdfBytes = await file.arrayBuffer();

  const projectsRes = await app.request('http://test/projects');
  const projectsBody = await json(projectsRes);
  if (!projectsRes.ok || !projectsBody.success || !Array.isArray(projectsBody.data) || !projectsBody.data.length) {
    console.error('No projects in DB. Run: bun run db:seed');
    process.exit(1);
  }
  const projectId = (projectsBody.data as { id: number }[])[0]!.id;

  const jobsRes = await app.request(`http://test/jobs?projectId=${projectId}`);
  const jobsBody = await json(jobsRes);
  if (!jobsRes.ok || !jobsBody.success || !Array.isArray(jobsBody.data) || !jobsBody.data.length) {
    console.error('No jobs for project', projectId, '. Run: bun run db:seed');
    process.exit(1);
  }
  const jobId = (jobsBody.data as { id: number }[])[0]!.id;

  const createRes = await app.request('http://test/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      name: 'E2E CSV PDF',
      email: `e2e-csv-${Date.now()}@test.local`,
      status: 'pending',
    }),
  });
  const createBody = await json(createRes);
  if (!createRes.ok || !createBody.success) {
    console.error('Create candidate failed', createRes.status, createBody);
    process.exit(1);
  }
  const candidateId = (createBody.data as { id: number }).id;
  idsToClean.push(candidateId);

  const form = new FormData();
  form.append('file', new File([pdfBytes], 'CSV.pdf', { type: 'application/pdf' }));

  const uploadRes = await app.request(`http://test/candidates/${candidateId}/cv`, {
    method: 'POST',
    body: form,
  });
  const uploadBody = await json(uploadRes);
  if (!uploadRes.ok || !uploadBody.success) {
    console.error('CV upload failed', uploadRes.status, uploadBody);
    process.exit(1);
  }

  const resumeText = (uploadBody.data as { resumeText?: string | null })?.resumeText ?? '';
  if (!resumeText.includes(E2E_CSV_PDF_SEARCH_TOKEN)) {
    console.error('Expected resumeText to contain search token after PDF extract. Got length', resumeText.length);
    process.exit(1);
  }

  const q = encodeURIComponent(E2E_CSV_PDF_SEARCH_TOKEN);
  const searchRes = await app.request(`http://test/candidates?projectId=${projectId}&q=${q}`);
  const searchBody = await json(searchRes);
  if (!searchRes.ok || !searchBody.success) {
    console.error('Search failed', searchRes.status, searchBody);
    process.exit(1);
  }
  const list = searchBody.data as { id: number }[];
  const found = list.some((c) => c.id === candidateId);
  if (!found) {
    console.error('Keyword search did not return the candidate after CV upload. Rows:', list.length);
    process.exit(1);
  }

  console.log('OK — CSV.pdf uploaded, text extracted, candidates search returned this profile.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    process.exit(process.exitCode ?? 0);
  });
