import { Hono } from 'hono';
import { FishjamClient } from '@fishjam-cloud/js-server-sdk';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq, asc } from 'drizzle-orm';
import { jobs, jobInterviewSteps } from './schema';
import {
  createInterviewSession,
  getSessionStatus,
  getSessionMeta,
  startSession,
  cleanupSession,
} from './interview';

const sqlite = new Database('dev.db');
const db = drizzle(sqlite);

export const roomsController = new Hono();

let fishjamClient: FishjamClient | null = null;

const getFishjamClient = () => {
  if (!fishjamClient) {
    const fishjamId = process.env.FISHJAM_ID;
    const managementToken = process.env.FISHJAM_MANAGEMENT_TOKEN;
    if (!fishjamId || !managementToken) {
      throw new Error('FISHJAM_ID or FISHJAM_MANAGEMENT_TOKEN environment variables are not set');
    }
    fishjamClient = new FishjamClient({ fishjamId, managementToken });
  }
  return fishjamClient;
};

roomsController.post('/join-room', async (c) => {
  try {
    const body = await c.req.json();
    const { roomName, peerName } = body;
    const client = getFishjamClient();
    const room = await client.createRoom();
    const { peerToken } = await client.createPeer(room.id, { metadata: { name: peerName } });
    return c.json({ roomId: room.id, peerToken });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Room join failed';
    console.error('Error joining room:', message);
    return c.json({ error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Interview sessions (Fishjam agent ↔ Gemini bridge)
// ---------------------------------------------------------------------------

roomsController.post('/interview-session', async (c) => {
  try {
    const body = await c.req.json();
    const shareCode = String(body.shareCode ?? '').trim().toUpperCase();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    const stepIndex = Number.isInteger(body.stepIndex) && body.stepIndex >= 0 ? body.stepIndex : 0;

    if (!shareCode || !name || !email) {
      return c.json({ success: false, error: 'shareCode, name, and email are required' }, 400);
    }
    if (name.length > 200 || email.length > 320) {
      return c.json({ success: false, error: 'Name or email too long' }, 400);
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      return c.json({ success: false, error: 'Invalid email format' }, 400);
    }

    const [jobRow] = await db.select().from(jobs).where(eq(jobs.shareCode, shareCode)).limit(1);
    if (!jobRow) {
      return c.json({ success: false, error: 'Invalid or expired share code' }, 404);
    }
    if (jobRow.status !== 'open') {
      return c.json({ success: false, error: 'This position is no longer accepting interviews' }, 410);
    }

    const steps = await db
      .select()
      .from(jobInterviewSteps)
      .where(eq(jobInterviewSteps.jobId, jobRow.id))
      .orderBy(asc(jobInterviewSteps.stepOrder));

    if (steps.length === 0) {
      return c.json({ success: false, error: 'No interview steps configured for this job' }, 400);
    }

    const step = steps[stepIndex];
    if (!step) {
      return c.json({ success: false, error: `Step index ${stepIndex} is out of range (${steps.length} steps available)` }, 400);
    }

    const client = getFishjamClient();
    const result = await createInterviewSession(client, {
      job: jobRow,
      step,
      stepIndex,
      totalSteps: steps.length,
      name,
      email,
    });

    return c.json({
      success: true,
      data: {
        ...result,
        fishjamId: process.env.FISHJAM_ID,
        totalSteps: steps.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Session creation failed';
    console.error('Interview session error:', message);
    return c.json({ success: false, error: message }, 500);
  }
});

roomsController.post('/interview-session/:sessionId/start', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json().catch(() => ({}));
    const stepIndex = Number.isInteger(body.stepIndex) && body.stepIndex >= 0 ? body.stepIndex : 0;

    const ok = startSession(sessionId, stepIndex);
    if (!ok) {
      return c.json({ success: false, error: 'Session not found or not ready' }, 404);
    }
    return c.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start session';
    console.error('Start session error:', message);
    return c.json({ success: false, error: message }, 500);
  }
});

roomsController.get('/interview-session/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId');
  const status = getSessionStatus(sessionId);
  if (!status) {
    return c.json({ success: false, error: 'Session not found' }, 404);
  }
  return c.json({ success: true, data: status });
});

roomsController.get('/interview-session/:sessionId/meta', (c) => {
  const sessionId = c.req.param('sessionId');
  const meta = getSessionMeta(sessionId);
  if (!meta) {
    return c.json({ success: false, error: 'Session not found' }, 404);
  }
  return c.json({ success: true, data: meta });
});

roomsController.delete('/interview-session/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId');
  cleanupSession(sessionId);
  return c.json({ success: true });
});
