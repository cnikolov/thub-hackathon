/** Gemini Live API connection, message handling, and tool-call routing. */

import { GoogleGenAI, Modality, Type, StartSensitivity, EndSensitivity } from '@google/genai';
import type { FishjamAgent, FishjamClient, TrackId, IncomingTrackData } from '@fishjam-cloud/js-server-sdk';
import { buildSystemPrompt } from './prompts';
import type { ActiveSession } from './sessions';
import { markComplete, touchActivity } from './sessions';
import { broadcast } from './ws';

// ── Public ────────────────────────────────────────────────────────────────

export type ConnectGeminiParams = {
  job: { title: string; description: string };
  step: {
    title: string;
    purpose: string;
    interviewType: string;
    durationMinutes?: number | null;
    systemPrompt: string;
    introPrompt?: string | null;
    outroPrompt?: string | null;
    questions: { id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[] | null;
    checklist?: { id: string; label: string; required: boolean }[] | null;
  };
  stepIndex: number;
  totalSteps: number;
};

export async function connectGemini(session: ActiveSession, params: ConnectGeminiParams) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    session.status = 'error';
    session.error = 'GEMINI_API_KEY not configured';
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const systemPrompt = buildSystemPrompt(params);
  const { agent, agentTrackId } = session;

  try {
    const geminiSession = await ai.live.connect({
      model: 'gemini-3.1-flash-live-preview',
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingBudget: 0 },
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: 20,
            silenceDurationMs: 1000,
          },
        },
        contextWindowCompression: { slidingWindow: {} },
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        tools: [
          {
            functionDeclarations: [
              {
                name: 'updateAssessment',
                description: "Update the candidate's real-time assessment score and notes based on their responses.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER, description: 'Current score from 0 to 100' },
                    notes: { type: Type.STRING, description: 'Brief observation about the candidate' },
                  },
                  required: ['score', 'notes'],
                },
              },
              {
                name: 'markIntroComplete',
                description: 'Call this when you have finished the INTRO phase (greeted, confirmed name, set expectations) and are moving into the OBJECTIVES phase.',
                parameters: { type: Type.OBJECT, properties: {}, required: [] },
              },
              {
                name: 'markChecklistItem',
                description: 'Mark a checklist item as covered after the candidate has answered or you have confirmed the information. Call this each time you cover a checklist item.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    itemLabel: { type: Type.STRING, description: 'The exact label of the checklist item that was just covered' },
                  },
                  required: ['itemLabel'],
                },
              },
              {
                name: 'startOutro',
                description: 'Call this when all objectives and checklist items are covered and you are transitioning into the OUTRO phase (wrap-up, feedback, farewell).',
                parameters: { type: Type.OBJECT, properties: {}, required: [] },
              },
              {
                name: 'promptCandidate',
                description: "Call this EVERY TIME you finish speaking and want the candidate to respond. This unmutes the candidate's microphone. You MUST call this after asking any question or making a statement that expects a reply.",
                parameters: { type: Type.OBJECT, properties: {}, required: [] },
              },
              {
                name: 'blockInterruptions',
                description: "Call this BEFORE you start an important statement, explanation, or multi-sentence response that you don't want the candidate to interrupt. It keeps the candidate's mic muted for the specified duration. After the time expires, the mic auto-unlocks. Use 3-8 seconds for short points, 8-15 for longer explanations. Always call promptCandidate AFTER you finish speaking to ensure the mic unlocks.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    seconds: { type: Type.NUMBER, description: 'How many seconds to keep the candidate muted (1-30)' },
                  },
                  required: ['seconds'],
                },
              },
              {
                name: 'completeInterview',
                description: 'Call this function when the interview round is finished and all questions have been covered.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    summary: { type: Type.STRING, description: 'Brief summary of the interview round' },
                  },
                  required: ['summary'],
                },
              },
            ],
          },
        ],
      },
      callbacks: {
        onopen: () => { /* waiting for /start call */ },
        onmessage: (message: unknown) => {
          handleGeminiMessage(session, agent, agentTrackId, message as Record<string, unknown>);
        },
        onclose: () => {
          if (session.status === 'active') markComplete(session);
        },
        onerror: (e: unknown) => {
          console.error(`[Session ${session.sessionId}] Gemini error:`, e);
          if (session.status !== 'complete') {
            session.status = 'error';
            session.error = 'AI connection error';
          }
        },
      },
    });

    session.geminiSession = geminiSession as unknown as ActiveSession['geminiSession'];
  } catch (err) {
    console.error(`[Session ${session.sessionId}] Failed to connect Gemini:`, err);
    session.status = 'error';
    session.error = 'Failed to connect to AI';
  }
}

// ── Audio relay — pipes candidate audio into Gemini ───────────────────────

export function relayTrackData(session: ActiveSession) {
  session.agent.on('trackData', (msg: IncomingTrackData) => {
    if (!session.geminiSession || session.status !== 'active') return;
    // Only relay audio from the candidate peer — ignore the agent's own
    // audio to prevent a feedback loop where Gemini responds to itself.
    if (msg.peerId === session.agentPeerId) return;
    touchActivity(session);
    try {
      const base64 = Buffer.from(msg.data).toString('base64');
      session.geminiSession.sendRealtimeInput({ audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
    } catch { /* session may be closed */ }
  });
}

// ── Audio buffer — accumulates small chunks to avoid playback stutter ────

const BUFFER_FLUSH_MS = 150;
const audioBuffers = new Map<string, { chunks: Uint8Array[]; timer: ReturnType<typeof setTimeout> | null }>();

function bufferAndSendAudio(sessionId: string, agent: FishjamAgent, agentTrackId: TrackId, pcm: Uint8Array) {
  let buf = audioBuffers.get(sessionId);
  if (!buf) {
    buf = { chunks: [], timer: null };
    audioBuffers.set(sessionId, buf);
  }
  buf.chunks.push(pcm);

  if (!buf.timer) {
    buf.timer = setTimeout(() => {
      flushAudioBuffer(sessionId, agent, agentTrackId);
    }, BUFFER_FLUSH_MS);
  }
}

function flushAudioBuffer(sessionId: string, agent: FishjamAgent, agentTrackId: TrackId) {
  const buf = audioBuffers.get(sessionId);
  if (!buf || buf.chunks.length === 0) return;

  const totalLen = buf.chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of buf.chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  buf.chunks.length = 0;
  buf.timer = null;

  try { agent.sendData(agentTrackId, merged); } catch { /* agent may have disconnected */ }
}

export function clearAudioBuffer(sessionId: string) {
  const buf = audioBuffers.get(sessionId);
  if (buf) {
    if (buf.timer) clearTimeout(buf.timer);
    audioBuffers.delete(sessionId);
  }
}

// ── Internal ──────────────────────────────────────────────────────────────

function handleGeminiMessage(
  session: ActiveSession,
  agent: FishjamAgent,
  agentTrackId: TrackId,
  message: Record<string, unknown>,
) {
  if (session.status === 'complete' || session.status === 'error') return;

  const sc = message.serverContent as Record<string, unknown> | undefined;

  if (sc?.modelTurn) {
    const mt = sc.modelTurn as { parts?: Array<{ inlineData?: { data?: string }; text?: string }> };
    for (const part of mt.parts ?? []) {
      if ((session.status as string) === 'complete') break;

      if (part.inlineData?.data) {
        const pcm24 = Buffer.from(part.inlineData.data, 'base64');
        const pcm16 = downsample24to16(pcm24);
        bufferAndSendAudio(session.sessionId, agent, agentTrackId, pcm16);
      }
      if (part.text?.includes('INTERVIEW_COMPLETE')) {
        flushAudioBuffer(session.sessionId, agent, agentTrackId);
        markComplete(session);
        return;
      }
    }
  }

  const outText = (sc?.outputTranscription as { text?: string } | undefined)?.text;
  if (outText) {
    session.messages.push({ role: 'ai', text: outText });
    if (outText.includes('INTERVIEW_COMPLETE')) {
      markComplete(session);
      return;
    }
  }

  const inText = (sc?.inputTranscription as { text?: string } | undefined)?.text;
  if (inText) {
    session.messages.push({ role: 'user', text: inText });
    touchActivity(session);
  }

  if (sc?.interrupted) {
    clearAudioBuffer(session.sessionId);
    try { agent.interruptTrack(agentTrackId); } catch { /* */ }
  }

  const tc = message.toolCall as { functionCalls?: Array<{ name?: string; args?: unknown; id?: string }> } | undefined;
  if (tc?.functionCalls) {
    for (const call of tc.functionCalls) {
      if (call.name === 'updateAssessment') {
        const raw = call.args as Record<string, unknown> | undefined;
        if (raw && typeof raw.score === 'number' && typeof raw.notes === 'string') {
          session.assessment = { score: Math.max(0, Math.min(100, raw.score)), notes: raw.notes };
          if (raw.notes.trim()) session.assessmentLog.push(raw.notes.trim());
          broadcast(session.sessionId, { type: 'assessment', score: session.assessment.score, notes: raw.notes });
        }
        try {
          session.geminiSession?.sendToolResponse({
            functionResponses: [{ name: 'updateAssessment', response: { status: 'success' }, id: call.id }],
          });
        } catch { /* */ }
      }

      if (call.name === 'markIntroComplete') {
        if (session.phase === 'intro') session.phase = 'objectives';
        broadcast(session.sessionId, { type: 'phase', phase: session.phase });
        try {
          session.geminiSession?.sendToolResponse({
            functionResponses: [{ name: 'markIntroComplete', response: { status: 'success' }, id: call.id }],
          });
        } catch { /* */ }
      }

      if (call.name === 'startOutro') {
        if (session.phase === 'objectives') session.phase = 'outro';
        broadcast(session.sessionId, { type: 'phase', phase: session.phase });
        try {
          session.geminiSession?.sendToolResponse({
            functionResponses: [{ name: 'startOutro', response: { status: 'success' }, id: call.id }],
          });
        } catch { /* */ }
      }

      if (call.name === 'markChecklistItem') {
        const raw = call.args as Record<string, unknown> | undefined;
        if (raw && typeof raw.itemLabel === 'string') {
          const label = raw.itemLabel.toLowerCase().trim();
          const item = session.checklist.find(
            (c) => !c.covered && (c.label.toLowerCase().trim().includes(label) || label.includes(c.label.toLowerCase().trim())),
          );
          if (item) item.covered = true;
        }
        broadcast(session.sessionId, { type: 'checklist', items: [...session.checklist] });
        try {
          session.geminiSession?.sendToolResponse({
            functionResponses: [{ name: 'markChecklistItem', response: { status: 'success' }, id: call.id }],
          });
        } catch { /* */ }
      }

      if (call.name === 'promptCandidate') {
        session.unmuteRequested = true;
        broadcast(session.sessionId, { type: 'unmute' });
        try {
          session.geminiSession?.sendToolResponse({
            functionResponses: [{ name: 'promptCandidate', response: { status: 'success' }, id: call.id }],
          });
        } catch { /* */ }
      }

      if (call.name === 'blockInterruptions') {
        const raw = call.args as Record<string, unknown> | undefined;
        const seconds = Math.max(1, Math.min(30, Number(raw?.seconds) || 5));
        broadcast(session.sessionId, { type: 'block', seconds });
        try {
          session.geminiSession?.sendToolResponse({
            functionResponses: [{ name: 'blockInterruptions', response: { status: 'success', seconds }, id: call.id }],
          });
        } catch { /* */ }
      }

      if (call.name === 'completeInterview') {
        try {
          session.geminiSession?.sendToolResponse({
            functionResponses: [{ name: 'completeInterview', response: { status: 'success' }, id: call.id }],
          });
        } catch { /* */ }
        markComplete(session);
        return;
      }
    }
  }
}

// ── Video capture — periodically grabs a JPEG frame from the candidate's camera ──

export function startVideoCapture(session: ActiveSession, fishjamClient: FishjamClient) {
  let candidateVideoTrackId: string | null = null;
  let frameCount = 0;

  const tryFindVideoTrack = async (): Promise<string | null> => {
    try {
      const room = await fishjamClient.getRoom(session.roomId);
      for (const peer of room.peers) {
        if (peer.id === session.agentPeerId) continue;
        for (const track of peer.tracks) {
          if (track.type === 'video' && track.id) return track.id;
        }
      }
    } catch (err) {
      console.warn(`[Session ${session.sessionId}] Failed to get room for video track discovery:`, err);
    }
    return null;
  };

  const captureLoop = async () => {
    if (session.status !== 'active' && session.status !== 'waiting') return;

    if (!candidateVideoTrackId) {
      candidateVideoTrackId = await tryFindVideoTrack();
      if (!candidateVideoTrackId) {
        console.log(`[Session ${session.sessionId}] No video track yet — will retry`);
        return;
      }
      console.log(`[Session ${session.sessionId}] Found candidate video track: ${candidateVideoTrackId}`);
    }

    try {
      const image = await session.agent.captureImage(candidateVideoTrackId, 4000);
      frameCount++;

      if (session.geminiSession && session.status === 'active') {
        const base64 = Buffer.from(image.data).toString('base64');
        const mimeType = image.contentType || 'image/jpeg';
        session.geminiSession.sendRealtimeInput({ video: { data: base64, mimeType } });
        console.log(`[Session ${session.sessionId}] Sent frame #${frameCount} to Gemini (${mimeType})`);
      }
    } catch (err) {
      console.error(`[Session ${session.sessionId}] captureImage failed:`, err);
      candidateVideoTrackId = null;
    }
  };

  session.videoFrameTimer = setInterval(() => {
    captureLoop().catch((err) => {
      console.error(`[Session ${session.sessionId}] Video capture loop error:`, err);
    });
  }, 3000);
}

// ── Audio helpers ─────────────────────────────────────────────────────────

/** Downsample PCM16 from 24 kHz to 16 kHz (ratio 3:2) via linear interpolation. */
function downsample24to16(buf: Buffer): Uint8Array {
  const srcSamples = buf.length >> 1;
  const dstSamples = Math.floor((srcSamples * 2) / 3);
  const out = new Int16Array(dstSamples);

  for (let i = 0; i < dstSamples; i++) {
    const srcPos = (i * 3) / 2;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;

    const s0 = buf.readInt16LE(idx * 2);
    const s1 = idx + 1 < srcSamples ? buf.readInt16LE((idx + 1) * 2) : s0;
    out[i] = Math.round(s0 + frac * (s1 - s0));
  }

  return new Uint8Array(out.buffer);
}
