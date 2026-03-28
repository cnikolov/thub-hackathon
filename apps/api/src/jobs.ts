import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { jobs, jobInterviewSteps, interviewAttendance } from './schema';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

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
      introPrompt: null as string | null,
      outroPrompt: null as string | null,
      questions: job.questions ?? [],
      checklist: null as { id: string; label: string; required: boolean }[] | null,
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
          introPrompt?: string;
          outroPrompt?: string;
          questions?: unknown[];
          checklist?: unknown[];
        };
        await db.insert(jobInterviewSteps).values({
          jobId: job.id,
          stepOrder: i + 1,
          title: String(s.title ?? `Step ${i + 1}`).trim() || `Step ${i + 1}`,
          purpose: String(s.purpose ?? s.title ?? 'Interview round').trim(),
          interviewType: s.interviewType === 'technical' ? 'technical' : 'intro',
          durationMinutes: s.durationMinutes ?? 15,
          systemPrompt: String(s.systemPrompt ?? firstPrompt).trim(),
          introPrompt: s.introPrompt?.trim() || null,
          outroPrompt: s.outroPrompt?.trim() || null,
          questions: (s.questions as JobRow['questions']) ?? [],
          checklist: (s.checklist as { id: string; label: string; required: boolean }[]) ?? [],
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
        introPrompt: null,
        outroPrompt: null,
        questions: body.questions ?? [],
        checklist: [],
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

jobsController.patch('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) return c.json({ success: false, error: 'Invalid id' }, 400);

    const [existing] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!existing) return c.json({ success: false, error: 'Job not found' }, 404);

    const body = await c.req.json();

    if (body.title || body.description || body.requirements) {
      await db.update(jobs).set({
        ...(body.title ? { title: body.title } : {}),
        ...(body.description ? { description: body.description } : {}),
        ...(body.requirements ? { requirements: body.requirements } : {}),
      }).where(eq(jobs.id, id));
    }

    const stepsIn = Array.isArray(body.interviewSteps) ? body.interviewSteps : null;
    if (stepsIn) {
      await db.delete(jobInterviewSteps).where(eq(jobInterviewSteps.jobId, id));

      for (let i = 0; i < stepsIn.length; i++) {
        const s = stepsIn[i] as {
          title?: string;
          purpose?: string;
          interviewType?: 'intro' | 'technical';
          durationMinutes?: number;
          systemPrompt?: string;
          introPrompt?: string;
          outroPrompt?: string;
          questions?: unknown[];
          checklist?: unknown[];
        };
        await db.insert(jobInterviewSteps).values({
          jobId: id,
          stepOrder: i + 1,
          title: String(s.title ?? `Step ${i + 1}`).trim() || `Step ${i + 1}`,
          purpose: String(s.purpose ?? s.title ?? 'Interview round').trim(),
          interviewType: s.interviewType === 'technical' ? 'technical' : 'intro',
          durationMinutes: s.durationMinutes ?? 15,
          systemPrompt: String(s.systemPrompt ?? 'You are a professional interviewer.').trim(),
          introPrompt: s.introPrompt?.trim() || null,
          outroPrompt: s.outroPrompt?.trim() || null,
          questions: (s.questions as JobRow['questions']) ?? [],
          checklist: (s.checklist as { id: string; label: string; required: boolean }[]) ?? [],
          createdAt: new Date(),
        });
      }
    }

    const [refreshed] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    const [final] = await enrichJobsWithSteps([refreshed!]);
    return c.json({ success: true, data: final });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Update failed';
    return c.json({ success: false, error: message }, 500);
  }
});

jobsController.post('/share/:shareCode/attendance', async (c) => {
  try {
    const shareCode = c.req.param('shareCode').toUpperCase();
    const [job] = await db.select().from(jobs).where(eq(jobs.shareCode, shareCode)).limit(1);
    if (!job) {
      return c.json({ success: false, error: 'Invalid share code' }, 404);
    }
    const body = await c.req.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    const round = typeof body.round === 'number' ? body.round : 1;
    if (!name || !email) {
      return c.json({ success: false, error: 'name and email are required' }, 400);
    }

    const [row] = await db
      .insert(interviewAttendance)
      .values({ jobId: job.id, name, email, round, joinedAt: new Date() })
      .returning();

    return c.json({ success: true, data: row });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Attendance failed';
    return c.json({ success: false, error: message }, 500);
  }
});

jobsController.patch('/attendance/:id/complete', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) {
      return c.json({ success: false, error: 'Invalid id' }, 400);
    }
    const [updated] = await db
      .update(interviewAttendance)
      .set({ completedAt: new Date() })
      .where(eq(interviewAttendance.id, id))
      .returning();
    if (!updated) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }
    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Update failed';
    return c.json({ success: false, error: message }, 500);
  }
});

jobsController.get('/attendance', async (c) => {
  try {
    const projectIdStr = c.req.query('projectId');
    const jobIdStr = c.req.query('jobId');

    let jobIds: number[] = [];

    if (jobIdStr) {
      const jid = parseInt(jobIdStr, 10);
      if (!Number.isNaN(jid)) jobIds = [jid];
    } else if (projectIdStr) {
      const pid = parseInt(projectIdStr, 10);
      if (!Number.isNaN(pid)) {
        const pJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.projectId, pid));
        jobIds = pJobs.map((j) => j.id);
      }
    }

    if (jobIds.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const rows = await db
      .select({
        id: interviewAttendance.id,
        jobId: interviewAttendance.jobId,
        name: interviewAttendance.name,
        email: interviewAttendance.email,
        round: interviewAttendance.round,
        joinedAt: interviewAttendance.joinedAt,
        completedAt: interviewAttendance.completedAt,
        jobTitle: jobs.title,
      })
      .from(interviewAttendance)
      .innerJoin(jobs, eq(interviewAttendance.jobId, jobs.id))
      .where(inArray(interviewAttendance.jobId, jobIds))
      .orderBy(desc(interviewAttendance.joinedAt));

    return c.json({ success: true, data: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'List failed';
    return c.json({ success: false, error: message }, 500);
  }
});
