/** Session types, in-memory store, and lifecycle helpers. */

import type {
  FishjamAgent,
  PeerId,
  RoomId,
  TrackId,
} from '@fishjam-cloud/js-server-sdk';

// ── Public status shape returned to the frontend ──────────────────────────

export type ChecklistProgress = { id: string; label: string; required: boolean; covered: boolean };

export type InterviewPhase = 'intro' | 'objectives' | 'outro' | 'complete';

export type SessionStatus = {
  status: 'waiting' | 'active' | 'complete' | 'error';
  phase: InterviewPhase;
  assessment: { score: number; notes: string };
  agentPeerId: string;
  transcript: string | null;
  checklist: ChecklistProgress[];
  error?: string;
};

// ── Internal session type ─────────────────────────────────────────────────

export type ActiveSession = {
  sessionId: string;
  roomId: RoomId;
  agentPeerId: PeerId;
  peerToken: string;
  agent: FishjamAgent;
  agentTrackId: TrackId;
  geminiSession: {
    sendRealtimeInput: (input: { audio?: { data: string; mimeType: string }; text?: string }) => void;
    sendToolResponse: (resp: { functionResponses: Array<{ name: string; response: unknown; id?: string }> }) => void;
    close: () => void;
  } | null;
  deleteRoom: () => Promise<void>;
  messages: { role: 'ai' | 'user'; text: string }[];
  assessment: { score: number; notes: string };
  status: 'waiting' | 'active' | 'complete' | 'error';
  error?: string;
  jobId: number;
  jobStepId: number | null;
  stepIndex: number;
  name: string;
  email: string;
  jobDescription: string;
  createdAt: number;
  /** Current interview phase: intro → objectives → outro → complete. */
  phase: InterviewPhase;
  /** Checklist items with live coverage tracking. */
  checklist: ChecklistProgress[];
  /** Timestamp of last candidate audio or text input. */
  lastActivityAt: number;
  /** Whether the AI has already sent a "are you still there?" nudge. */
  nudgeSent: boolean;
  /** Handle for the inactivity check interval. */
  inactivityTimer: ReturnType<typeof setInterval> | null;
};

// ── Store ─────────────────────────────────────────────────────────────────

export const sessions = new Map<string, ActiveSession>();

// ── Helpers ───────────────────────────────────────────────────────────────

export function teardown(s: ActiveSession) {
  if (s.inactivityTimer) { clearInterval(s.inactivityTimer); s.inactivityTimer = null; }
  try { s.geminiSession?.close(); } catch { /* */ }
  try { s.agent.disconnect(); } catch { /* */ }
  s.deleteRoom().catch(() => {});
}

export function markComplete(session: ActiveSession) {
  if (session.status === 'complete') return;
  session.status = 'complete';
  session.phase = 'complete';
  if (session.inactivityTimer) { clearInterval(session.inactivityTimer); session.inactivityTimer = null; }
  try { session.geminiSession?.close(); } catch { /* */ }
  session.geminiSession = null;
  try { session.agent.disconnect(); } catch { /* */ }
  session.deleteRoom().catch(() => {});
}

/** Record that the candidate did something (spoke, sent audio). */
export function touchActivity(session: ActiveSession) {
  session.lastActivityAt = Date.now();
  session.nudgeSent = false;
}

// ── Inactivity monitor ───────────────────────────────────────────────────

const NUDGE_AFTER_MS = 30_000;
const KICK_AFTER_MS = 60_000;

export function startInactivityMonitor(session: ActiveSession) {
  if (session.inactivityTimer) return;

  session.lastActivityAt = Date.now();
  session.nudgeSent = false;

  session.inactivityTimer = setInterval(() => {
    if (session.status !== 'active') {
      if (session.inactivityTimer) { clearInterval(session.inactivityTimer); session.inactivityTimer = null; }
      return;
    }

    const idle = Date.now() - session.lastActivityAt;

    if (idle >= KICK_AFTER_MS && session.nudgeSent) {
      try {
        session.geminiSession?.sendRealtimeInput({
          text: 'The candidate has been unresponsive for over a minute. Politely end the interview — say something like "It seems like you may have stepped away. I\'ll go ahead and wrap up for now. Thank you for your time, and feel free to rejoin if you\'d like to continue." Then call completeInterview.',
        });
      } catch { /* */ }
      return;
    }

    if (idle >= NUDGE_AFTER_MS && !session.nudgeSent) {
      session.nudgeSent = true;
      try {
        session.geminiSession?.sendRealtimeInput({
          text: 'The candidate has been quiet for about 30 seconds. Gently check in — say something like "Hey, are you still there? Take your time if you need a moment."',
        });
      } catch { /* */ }
    }
  }, 5_000);
}

// ── Reaper — garbage-collects stale sessions ──────────────────────────────

const reaperInterval = setInterval(() => {
  const longCutoff = Date.now() - 2 * 60 * 60 * 1000;
  const shortCutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, s] of sessions) {
    const shouldReap =
      s.createdAt < longCutoff ||
      (s.status === 'error' && s.createdAt < shortCutoff) ||
      (s.status === 'complete' && s.createdAt < shortCutoff);
    if (shouldReap) {
      teardown(s);
      sessions.delete(id);
    }
  }
}, 60_000);

export function shutdownReaper() {
  clearInterval(reaperInterval);
  for (const [, s] of sessions) teardown(s);
  sessions.clear();
}
