/**
 * Generates test-fixtures/CSV.pdf — tabular “CSV-style” resume text for E2E CV upload tests.
 * Run from apps/api: bun run scripts/generate-csv-pdf.ts
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_CSV_PDF_SEARCH_TOKEN } from './e2e-tokens.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const lines = [
    'Resume — CSV-style sample (E2E)',
    '',
    'Name,Email,Skills',
    'Jane Doe,jane.doe+csv@e2e.test,React;TypeScript;Node',
    '',
    `Search token: ${E2E_CSV_PDF_SEARCH_TOKEN}`,
    'Availability: 2 weeks notice',
  ];
  let y = 750;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 16;
  }
  const bytes = await pdf.save();
  const outDir = join(__dirname, '../test-fixtures');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'CSV.pdf');
  await Bun.write(outPath, bytes);
  console.log(`Wrote ${outPath} (${bytes.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
