import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { projects, jobs, candidates } from './schema';
import { count, eq, inArray, desc, sql, and } from 'drizzle-orm';

const sqlite = new Database('dev.db');
const db = drizzle(sqlite);

export const dashboardController = new Hono();

type Trend = 'up' | 'down' | 'neutral';

function stat(value: string | number, change: string, trend: Trend) {
  return { value, change, trend };
}

/** GET /dashboard/stats?projectId= optional — scopes jobs/candidates to that project */
dashboardController.get('/stats', async (c) => {
  try {
    const projectIdStr = c.req.query('projectId');
    const projectId = projectIdStr ? parseInt(projectIdStr, 10) : NaN;
    const scoped = !Number.isNaN(projectId);

    const totalProjectsRow = await db.select({ totalProjects: count() }).from(projects);
    const totalProjects = totalProjectsRow[0]?.totalProjects ?? 0;

    let jobIds: number[] = [];
    if (scoped) {
      const rows = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.projectId, projectId));
      jobIds = rows.map((r) => r.id);
    }

    const openJobs = scoped
      ? (await db
          .select({ c: count() })
          .from(jobs)
          .where(and(eq(jobs.projectId, projectId), eq(jobs.status, 'open'))))[0]!.c
      : (await db.select({ c: count() }).from(jobs).where(eq(jobs.status, 'open')))[0]!.c;

    const candFilter =
      scoped && jobIds.length > 0
        ? inArray(candidates.jobId, jobIds)
        : scoped && jobIds.length === 0
          ? sql`1 = 0`
          : undefined;

    const totalCandidates = candFilter
      ? (await db.select({ c: count() }).from(candidates).where(candFilter))[0]!.c
      : (await db.select({ c: count() }).from(candidates))[0]!.c;

    const pendingCount = candFilter
      ? (await db
          .select({ c: count() })
          .from(candidates)
          .where(and(candFilter, eq(candidates.status, 'pending'))))[0]!.c
      : (await db.select({ c: count() }).from(candidates).where(eq(candidates.status, 'pending')))[0]!.c;

    const avgExpr = sql<number>`coalesce(round(avg(${candidates.score})), 0)`;
    const [avgRow] = candFilter
      ? await db
          .select({ avg: avgExpr })
          .from(candidates)
          .where(and(candFilter, sql`${candidates.score} is not null`))
      : await db
          .select({ avg: avgExpr })
          .from(candidates)
          .where(sql`${candidates.score} is not null`);

    const satisfactionRate = Math.min(100, Math.max(0, Number(avgRow?.avg ?? 0)));

    const projectsShown = scoped ? 1 : totalProjects;

    const scheduleJobs = scoped
      ? await db.select().from(jobs).where(eq(jobs.projectId, projectId)).orderBy(desc(jobs.createdAt)).limit(3)
      : await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(3);

    const palette = ['bg-primary', 'bg-blue-500', 'bg-orange-500'];
    const times = ['09:00 AM', '01:00 PM', '03:00 PM'];
    const schedules =
      scheduleJobs.length > 0
        ? scheduleJobs.map((j, i) => ({
            id: String(j.id),
            title: 'Talent Acquisition',
            subtitle: `Interview — ${j.title}`,
            time: times[i] ?? '10:00 AM',
            color: palette[i % palette.length] ?? 'bg-primary',
          }))
        : [
            {
              id: 'placeholder-1',
              title: 'Talent Acquisition',
              subtitle: 'Add a job posting to see interviews here',
              time: '09:00 AM',
              color: 'bg-primary',
            },
            {
              id: 'placeholder-2',
              title: 'Employee Development',
              subtitle: 'Mid-year performance review',
              time: '01:00 PM',
              color: 'bg-blue-500',
            },
            {
              id: 'placeholder-3',
              title: 'Workplace Engagement',
              subtitle: 'Quarterly policy review',
              time: '03:00 PM',
              color: 'bg-orange-500',
            },
          ];

    return c.json({
      success: true,
      data: {
        totalEmployees: stat(projectsShown, `${totalProjects} workspace${totalProjects === 1 ? '' : 's'}`, totalProjects > 0 ? 'up' : 'neutral'),
        attendance: stat(openJobs, `${openJobs} open role${openJobs === 1 ? '' : 's'}`, openJobs > 0 ? 'up' : 'neutral'),
        leaveRequests: stat(pendingCount, `${pendingCount} pending review${pendingCount === 1 ? '' : 's'}`, pendingCount > 0 ? 'neutral' : 'up'),
        jobApplicants: stat(totalCandidates, `${totalCandidates} in pipeline`, totalCandidates > 0 ? 'up' : 'neutral'),
        schedules,
        satisfactionRate,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Dashboard error';
    return c.json({ success: false, error: message }, 500);
  }
});
