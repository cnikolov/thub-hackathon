/** Session types, in-memory store, and lifecycle helpers. */

import type {
  FishjamAgent,
  PeerId,
  RoomId,
  TrackId,
} from '@fishjam-cloud/js-server-sdk';
import { broadcast } from './ws';
import { clearAudioBuffer } from './gemini';

// ── Public status shape returned to the frontend ──────────────────────────

export type ChecklistProgress = { id: string; label: string; required: boolean; covered: boolean };

export type InterviewPhase = 'intro' | 'objectives' | 'outro' | 'complete';

export type SessionStatus = {
  status: 'waiting' | 'active' | 'complete' | 'error';
  phase: InterviewPhase;
  assessment: { score: number; notes: string };
  /** Accumulated observations from every updateAssessment call during the interview. */
  assessmentLog: string[];
  agentPeerId: string;
  transcript: string | null;
  checklist: ChecklistProgress[];
  error?: string;
  /** AI requested the candidate be unmuted so it can hear a response. */
  unmuteRequested: boolean;
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
    sendRealtimeInput: (input: { audio?: { data: string; mimeType: string }; video?: { data: string; mimeType: string }; text?: string }) => void;
    sendToolResponse: (resp: { functionResponses: Array<{ name: string; response: unknown; id?: string }> }) => void;
    close: () => void;
  } | null;
  deleteRoom: () => Promise<void>;
  messages: { role: 'ai' | 'user'; text: string }[];
  assessment: { score: number; notes: string };
  /** Every observation from updateAssessment calls, in chronological order. */
  assessmentLog: string[];
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
  /** Handle for the periodic video-frame capture interval. */
  videoFrameTimer: ReturnType<typeof setInterval> | null;
  /** AI called promptCandidate — frontend should unmute. */
  unmuteRequested: boolean;
};

// ── Store ─────────────────────────────────────────────────────────────────

export const sessions = new Map<string, ActiveSession>();

// ── Helpers ───────────────────────────────────────────────────────────────

export function teardown(s: ActiveSession) {
  clearAudioBuffer(s.sessionId);
  if (s.inactivityTimer) { clearInterval(s.inactivityTimer); s.inactivityTimer = null; }
  if (s.videoFrameTimer) { clearInterval(s.videoFrameTimer); s.videoFrameTimer = null; }
  try { s.geminiSession?.close(); } catch { /* */ }
  try { s.agent.disconnect(); } catch { /* */ }
  s.deleteRoom().catch(() => {});
}

export function markComplete(session: ActiveSession) {
  if (session.status === 'complete') return;
  session.status = 'complete';
  session.phase = 'complete';
  clearAudioBuffer(session.sessionId);
  if (session.inactivityTimer) { clearInterval(session.inactivityTimer); session.inactivityTimer = null; }
  if (session.videoFrameTimer) { clearInterval(session.videoFrameTimer); session.videoFrameTimer = null; }
  try { session.geminiSession?.close(); } catch { /* */ }
  session.geminiSession = null;
  try { session.agent.disconnect(); } catch { /* */ }
  session.deleteRoom().catch(() => {});

  const transcript = session.messages.map((m) => `${m.role}: ${m.text}`).join('\n');
  broadcast(session.sessionId, {
    type: 'complete',
    transcript,
    assessmentLog: session.assessmentLog,
  });
}

/** Record that the candidate did something (spoke, sent audio). */
export function touchActivity(session: ActiveSession) {
  session.lastActivityAt = Date.now();
  session.nudgeSent = false;
}

// ── Inactivity monitor ───────────────────────────────────────────────────

const NUDGE_AFTER_MS = 5_000;
const KICK_AFTER_MS = 30_000;
const CHECK_INTERVAL_MS = 2_000;

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
          text: 'The candidate has been unresponsive for 30 seconds after your check-in. Politely end the interview — say "It seems like you may have stepped away. I\'ll wrap up for now — thanks for your time!" Then call completeInterview.',
        });
      } catch { /* */ }
      return;
    }

    if (idle >= NUDGE_AFTER_MS && !session.nudgeSent) {
      session.nudgeSent = true;
      try {
        session.geminiSession?.sendRealtimeInput({
          text: 'The candidate has been silent for a few seconds. Briefly repeat your last question or ask "Can you hear me?" to check the connection. Keep it short — one sentence max.',
        });
      } catch { /* */ }
    }
  }, CHECK_INTERVAL_MS);
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
