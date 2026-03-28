/** Gemini Live API connection, message handling, and tool-call routing. */

import { GoogleGenAI, Modality, Type, ThinkingLevel, StartSensitivity, EndSensitivity } from '@google/genai';
import type { FishjamAgent, FishjamClient, TrackId, IncomingTrackData } from '@fishjam-cloud/js-server-sdk';
import { buildSystemPrompt } from './prompts';
import type { ActiveSession } from './sessions';
import { markComplete, touchActivity } from './sessions';

// ── Public ────────────────────────────────────────────────────────────────

export type ConnectGeminiParams = {
  job: { title: string; description: string };
  step: {
    title: string;
    purpose: string;
    interviewType: string;
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
            prefixPaddingMs: 20,
            silenceDurationMs: 500,
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
    touchActivity(session);
    try {
      const base64 = Buffer.from(msg.data).toString('base64');
      session.geminiSession.sendRealtimeInput({ audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
    } catch { /* session may be closed */ }
  });
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
        try { agent.sendData(agentTrackId, pcm16); } catch { /* agent may have disconnected */ }
      }
      if (part.text?.includes('INTERVIEW_COMPLETE')) {
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
    try { agent.interruptTrack(agentTrackId); } catch { /* */ }
  }

  const tc = message.toolCall as { functionCalls?: Array<{ name?: string; args?: unknown; id?: string }> } | undefined;
  if (tc?.functionCalls) {
    for (const call of tc.functionCalls) {
      if (call.name === 'updateAssessment') {
        const raw = call.args as Record<string, unknown> | undefined;
        if (raw && typeof raw.score === 'number' && typeof raw.notes === 'string') {
          session.assessment = { score: Math.max(0, Math.min(100, raw.score)), notes: raw.notes };
        }
        try {
          session.geminiSession?.sendToolResponse({
            functionResponses: [{ name: 'updateAssessment', response: { status: 'success' }, id: call.id }],
          });
        } catch { /* */ }
      }

      if (call.name === 'markIntroComplete') {
        if (session.phase === 'intro') session.phase = 'objectives';
        try {
          session.geminiSession?.sendToolResponse({
            functionResponses: [{ name: 'markIntroComplete', response: { status: 'success' }, id: call.id }],
          });
        } catch { /* */ }
      }

      if (call.name === 'startOutro') {
        if (session.phase === 'objectives') session.phase = 'outro';
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
        try {
          session.geminiSession?.sendToolResponse({
            functionResponses: [{ name: 'markChecklistItem', response: { status: 'success' }, id: call.id }],
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

// ── Video capture ────────────────────────────────────────────────────────

const VIDEO_CAPTURE_INTERVAL_MS = 1_000; // 1 FPS — Gemini's recommended rate

export function startVideoCapture(session: ActiveSession, fishjamClient: FishjamClient) {
  let candidateVideoTrackId: string | null = null;
  let discovering = false;

  async function discoverVideoTrack() {
    if (discovering) return;
    discovering = true;
    try {
      const room = await fishjamClient.getRoom(session.roomId);
      for (const peer of room.peers) {
        if (peer.id === session.agentPeerId) continue;
        const videoTrack = peer.tracks?.find(
          (t: any) => t.type === 1 || t.type === 'TRACK_TYPE_VIDEO' || t.metadata?.type === 'camera'
        );
        if (videoTrack?.id) {
          candidateVideoTrackId = videoTrack.id;
          console.log('[video-capture] Discovered candidate video track:', candidateVideoTrackId);
          break;
        }
      }
    } catch (err) {
      console.warn('[video-capture] Failed to discover video track:', err);
    } finally {
      discovering = false;
    }
  }

  session.videoFrameTimer = setInterval(async () => {
    if ((session.status as string) === 'complete') {
      if (session.videoFrameTimer) { clearInterval(session.videoFrameTimer); session.videoFrameTimer = null; }
      return;
    }
    if (!session.geminiSession) return;

    if (!candidateVideoTrackId) {
      await discoverVideoTrack();
      if (!candidateVideoTrackId) return;
    }

    try {
      const image = await session.agent.captureImage(candidateVideoTrackId, 3_000);
      const base64 = Buffer.from(image.data).toString('base64');
      session.geminiSession?.sendRealtimeInput({
        video: { data: base64, mimeType: image.contentType || 'image/jpeg' },
      });
    } catch {
      candidateVideoTrackId = null;
    }
  }, VIDEO_CAPTURE_INTERVAL_MS);
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
