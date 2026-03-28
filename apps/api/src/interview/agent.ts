/** Orchestrator — creates, starts, queries, and cleans up interview sessions. */

import type { FishjamClient, AgentCallbacks } from '@fishjam-cloud/js-server-sdk';
import { sessions, teardown, startInactivityMonitor, type ActiveSession, type SessionStatus } from './sessions';
import { connectGemini, relayTrackData, startVideoCapture } from './gemini';
import { getKickoffMessage } from './prompts';

// ── Query helpers ─────────────────────────────────────────────────────────

export function getSessionStatus(sessionId: string): SessionStatus | null {
  const s = sessions.get(sessionId);
  if (!s) return null;
  return {
    status: s.status,
    phase: s.phase,
    assessment: s.assessment,
    agentPeerId: s.agentPeerId as string,
    transcript: s.status === 'complete' ? s.messages.map((m) => `${m.role}: ${m.text}`).join('\n') : null,
    checklist: s.checklist,
    error: s.error,
  };
}

export function getSessionMeta(sessionId: string) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  return { jobId: s.jobId, jobStepId: s.jobStepId, name: s.name, email: s.email };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

export async function createInterviewSession(
  fishjamClient: FishjamClient,
  params: {
    job: { id: number; title: string; description: string };
    step: {
      id: number | null;
      title: string;
      purpose: string;
      interviewType: string;
      durationMinutes: number | null;
      systemPrompt: string;
      questions: { id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[] | null;
      checklist?: { id: string; label: string; required: boolean }[] | null;
    };
    stepIndex: number;
    totalSteps: number;
    name: string;
    email: string;
  },
): Promise<{ sessionId: string; peerToken: string; agentPeerId: string }> {
  const sessionId = crypto.randomUUID();

  const room = await fishjamClient.createRoom({ roomType: 'full_feature' as const });
  const deleteRoom = async () => { try { await fishjamClient.deleteRoom(room.id); } catch { /* */ } };

  let peerToken: string;
  let agent: Awaited<ReturnType<FishjamClient['createAgent']>>['agent'];
  let agentPeer: { id: string };

  try {
    const peerResult = await fishjamClient.createPeer(room.id, {
      metadata: { name: params.name, role: 'candidate' },
    });
    peerToken = peerResult.peerToken;

    const agentCallbacks: AgentCallbacks = {
      onError: (e) => {
        console.error(`[Session ${sessionId}] Agent error:`, e);
        const s = sessions.get(sessionId);
        if (s && s.status !== 'complete') {
          s.status = 'error';
          s.error = 'Agent connection error';
        }
      },
      onClose: (_code, reason) => {
        console.log(`[Session ${sessionId}] Agent closed: ${reason}`);
      },
    };

    const agentResult = await fishjamClient.createAgent(
      room.id,
      { subscribeMode: 'auto' as const, output: { audioFormat: 'pcm16' as const, audioSampleRate: 16000 as const } },
      agentCallbacks,
    );
    agent = agentResult.agent;
    agentPeer = agentResult.peer;
  } catch (err) {
    await deleteRoom();
    throw err;
  }

  const agentTrack = agent.createTrack({ encoding: 'pcm16', sampleRate: 16000, channels: 1 });

  const session: ActiveSession = {
    sessionId,
    roomId: room.id,
    agentPeerId: agentPeer.id as any,
    peerToken,
    agent,
    agentTrackId: agentTrack.id,
    geminiSession: null,
    deleteRoom,
    messages: [],
    assessment: { score: 0, notes: '' },
    status: 'waiting',
    jobId: params.job.id,
    jobStepId: params.step.id,
    stepIndex: params.stepIndex,
    name: params.name,
    email: params.email,
    jobDescription: params.job.description,
    createdAt: Date.now(),
    phase: 'intro',
    checklist: (params.step.checklist ?? []).map((c) => ({ ...c, covered: false })),
    lastActivityAt: Date.now(),
    nudgeSent: false,
    inactivityTimer: null,
    videoFrameTimer: null,
  };
  sessions.set(sessionId, session);

  await connectGemini(session, params);

  if (session.status === 'error') {
    teardown(session);
    sessions.delete(sessionId);
    throw new Error(session.error ?? 'Failed to initialize AI session');
  }

  relayTrackData(session);
  startVideoCapture(session, fishjamClient);

  return { sessionId, peerToken, agentPeerId: agentPeer.id as string };
}

export function startSession(sessionId: string, stepIndex: number): boolean {
  const s = sessions.get(sessionId);
  if (!s?.geminiSession || s.status !== 'waiting') return false;

  s.status = 'active';
  const kickoff = getKickoffMessage(stepIndex);
  try {
    s.geminiSession.sendRealtimeInput({ text: kickoff });
  } catch (err) {
    console.error(`[Session ${sessionId}] Failed to send kickoff:`, err);
  }
  startInactivityMonitor(s);
  return true;
}

export function cleanupSession(sessionId: string): boolean {
  const s = sessions.get(sessionId);
  if (!s) return false;
  teardown(s);
  sessions.delete(sessionId);
  return true;
}
