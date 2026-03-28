import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { jobs, jobInterviewSteps } from './schema';
import { asc, eq, inArray } from 'drizzle-orm';

const sqlite = new Database('dev.db');
const db = drizzle(sqlite);

type JobRow = typeof jobs.$inferSelect;

function syntheticInterviewSteps(job: JobRow) {
  return [
    {
      id: null as number | null,
      jobId: job.id,
      stepOrder: 1,
      title: 'Interview',
      purpose: 'Standard interview for this role',
      interviewType: job.interviewType,
      durationMinutes: job.durationMinutes,
      systemPrompt: job.systemPrompt,
      questions: job.questions ?? [],
      createdAt: job.createdAt,
      legacy: true as const,
    },
  ];
}

async function enrichJobsWithSteps(jobRows: JobRow[]) {
  if (jobRows.length === 0) return [];
  const ids = jobRows.map((j) => j.id);
  const allSteps = await db
    .select()
    .from(jobInterviewSteps)
    .where(inArray(jobInterviewSteps.jobId, ids))
    .orderBy(asc(jobInterviewSteps.jobId), asc(jobInterviewSteps.stepOrder));

  const map = new Map<number, (typeof allSteps)[number][]>();
  for (const s of allSteps) {
    const arr = map.get(s.jobId) ?? [];
    arr.push(s);
    map.set(s.jobId, arr);
  }

  return jobRows.map((job) => {
    const st = map.get(job.id);
    const interviewSteps =
      st && st.length > 0
        ? st.map((row) => ({ ...row, legacy: false as const }))
        : syntheticInterviewSteps(job);
    return { ...job, interviewSteps };
  });
}

export const jobsController = new Hono();

jobsController.get('/share/:shareCode', async (c) => {
  try {
    const raw = c.req.param('shareCode');
    const shareCode = raw.toUpperCase();
    const row = await db.select().from(jobs).where(eq(jobs.shareCode, shareCode)).limit(1);
    if (!row.length) {
      return c.json({ success: false, error: 'Invalid or expired code' }, 404);
    }
    const [enriched] = await enrichJobsWithSteps([row[0]!]);
    return c.json({ success: true, data: enriched });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lookup failed';
    return c.json({ success: false, error: message }, 500);
  }
});

jobsController.get('/', async (c) => {
  try {
    const projectIdStr = c.req.query('projectId');
    let allJobs: JobRow[];
    if (projectIdStr) {
      const projectId = parseInt(projectIdStr, 10);
      allJobs = await db.select().from(jobs).where(eq(jobs.projectId, projectId));
    } else {
      allJobs = await db.select().from(jobs);
    }
    const data = await enrichJobsWithSteps(allJobs);
    return c.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'List failed';
    return c.json({ success: false, error: message }, 500);
  }
});

jobsController.post('/', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.title || !body.projectId || !body.description) {
      return c.json({ success: false, error: 'Title, projectId, and description are required' }, 400);
    }

    const shareCode =
      typeof body.shareCode === 'string' && body.shareCode.trim().length >= 4
        ? String(body.shareCode).toUpperCase()
        : Math.random().toString(36).substring(2, 8).toUpperCase();

    const stepsIn = Array.isArray(body.interviewSteps) ? body.interviewSteps : null;
    const firstPrompt =
      stepsIn?.[0]?.systemPrompt ?? body.systemPrompt ?? 'You are a professional interviewer.';

    const [newJob] = await db
      .insert(jobs)
      .values({
        projectId: body.projectId,
        title: body.title,
        description: body.description,
        requirements: body.requirements || '',
        systemPrompt: firstPrompt,
        shareCode,
        status: body.status || 'open',
        interviewType: body.interviewType || 'intro',
        durationMinutes: body.durationMinutes || 15,
        questions: body.questions || [],
        createdAt: new Date(),
      })
      .returning();

    const job = newJob!;

    if (stepsIn && stepsIn.length > 0) {
      for (let i = 0; i < stepsIn.length; i++) {
        const s = stepsIn[i] as {
          title?: string;
          purpose?: string;
          interviewType?: 'intro' | 'technical';
          durationMinutes?: number;
          systemPrompt?: string;
          questions?: unknown[];
        };
        await db.insert(jobInterviewSteps).values({
          jobId: job.id,
          stepOrder: i + 1,
          title: String(s.title ?? `Step ${i + 1}`).trim() || `Step ${i + 1}`,
          purpose: String(s.purpose ?? s.title ?? 'Interview round').trim(),
          interviewType: s.interviewType === 'technical' ? 'technical' : 'intro',
          durationMinutes: s.durationMinutes ?? 15,
          systemPrompt: String(s.systemPrompt ?? firstPrompt).trim(),
          questions: (s.questions as JobRow['questions']) ?? [],
          createdAt: new Date(),
        });
      }
    } else {
      await db.insert(jobInterviewSteps).values({
        jobId: job.id,
        stepOrder: 1,
        title: 'Interview',
        purpose: 'Standard interview for this role',
        interviewType: body.interviewType || 'intro',
        durationMinutes: body.durationMinutes || 15,
        systemPrompt: String(body.systemPrompt ?? firstPrompt),
        questions: body.questions ?? [],
        createdAt: new Date(),
      });
    }

    const [out] = await enrichJobsWithSteps([job]);
    return c.json({ success: true, data: out });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Create failed';
    return c.json({ success: false, error: message }, 500);
  }
});
