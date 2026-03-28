/**
 * E2E: verify that searching by name returns that candidate FIRST,
 * even when many other candidates match the same token in their notes/transcript.
 *
 * Run: bun run scripts/e2e-name-priority.ts   (needs seeded dev.db)
 */
import { app } from '../src/index.ts';

const TAG = `np_${Date.now()}`;

async function json(res: Response) {
  return JSON.parse(await res.text()) as {
    success?: boolean;
    error?: string;
    data?: unknown;
  };
}

async function main() {
  const projectsRes = await app.request('http://t/projects');
  const projects = await json(projectsRes);
  const projectId = (projects.data as { id: number }[])?.[0]?.id;
  if (!projectId) {
    console.error('No projects — run db:seed');
    process.exit(1);
  }

  const jobsRes = await app.request(`http://t/jobs?projectId=${projectId}`);
  const jobsBody = await json(jobsRes);
  const jobId = (jobsBody.data as { id: number }[])?.[0]?.id;
  if (!jobId) {
    console.error('No jobs');
    process.exit(1);
  }

  const nameMatchCandidate = await app.request('http://t/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      name: `Zynara ${TAG}`,
      email: `zynara-${TAG}@test.local`,
      notes: 'Solid performer.',
      status: 'interviewed',
    }),
  });
  const nmBody = await json(nameMatchCandidate);
  const nameId = (nmBody.data as { id: number }).id;

  const bodyOnlyIds: number[] = [];
  for (let i = 0; i < 5; i++) {
    const res = await app.request('http://t/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        name: `Other Person ${i}`,
        email: `other-${TAG}-${i}@test.local`,
        notes: `Mentioned Zynara ${TAG} during the interview as a reference.`,
        status: 'interviewed',
      }),
    });
    const b = await json(res);
    bodyOnlyIds.push((b.data as { id: number }).id);
  }

  const q = encodeURIComponent(`Zynara ${TAG}`);
  const searchRes = await app.request(
    `http://t/candidates?projectId=${projectId}&q=${q}`,
  );
  const searchBody = await json(searchRes);
  const list = searchBody.data as { id: number; name: string }[];

  if (list.length === 0) {
    console.error('FAIL: search returned 0 results');
    process.exit(1);
  }

  if (list[0]!.id !== nameId) {
    console.error(
      `FAIL: expected first result to be the name-match candidate (id ${nameId}), got id ${list[0]!.id} ("${list[0]!.name}")`,
    );
    console.error('Full list:', list.map((c) => `${c.id}:${c.name}`).join(', '));
    process.exit(1);
  }

  console.log(
    `OK — "${list[0]!.name}" (name match) ranked #1 out of ${list.length} results.`,
  );
  console.log(
    'Order:',
    list.map((c, i) => `#${i + 1} ${c.name}`).join(' | '),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
