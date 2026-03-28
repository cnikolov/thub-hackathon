import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { populateSampleData } from './seed-data';

const sqlite = new Database('dev.db');
const db = drizzle(sqlite);

export const devController = new Hono();

/**
 * POST /dev/seed — insert sample projects, jobs, and candidates.
 * Body: { "reset": true } clears existing rows first (dev / local only).
 */
devController.post('/seed', async (c) => {
  if (process.env.ALLOW_DEV_SEED === '0') {
    return c.json({ success: false, error: 'Dev seed disabled' }, 403);
  }
  try {
    const body = await c.req.json().catch(() => ({}));
    const reset = (body as { reset?: boolean }).reset !== false;
    const result = await populateSampleData(db, { clearFirst: reset });
    return c.json({
      success: true,
      data: result,
      message: reset ? 'Database reset and populated' : 'Sample data appended',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Seed failed';
    return c.json({ success: false, error: message }, 500);
  }
});

/** GET /dev/health — quick check that dev routes are mounted */
devController.get('/health', (c) => c.json({ ok: true, dev: true }));
