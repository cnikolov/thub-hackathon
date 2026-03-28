import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase,
  Check,
  LogOut,
  Mic,
  Plus,
  Sparkles,
} from 'lucide-react';
import { GoogleGenAI, Modality, Type, ThinkingLevel } from '@google/genai';
import { api, type ApiResult } from '../lib/api';
import type { Candidate, Job, JobInterviewStep } from '../lib/types';
import { cn } from '../lib/utils';

const LIVE_MODEL =
  import.meta.env.VITE_GEMINI_LIVE_MODEL ?? 'gemini-2.0-flash-live';

function getSortedSteps(job: Job): JobInterviewStep[] {
  const s = job.interviewSteps ?? [];
  return [...s].sort((a, b) => a.stepOrder - b.stepOrder);
}

function isLegacyStep(step: JobInterviewStep | undefined) {
  return step != null && (step.legacy === true || step.id == null);
}

function buildLiveSystemPrompt(
  job: Job,
  active: JobInterviewStep,
  roundIdx: number,
  totalRounds: number,
) {
  const qs = (active.questions ?? [])
    .filter((q) => q.isMandatory)
    .map((q) => `- ${q.text}`)
    .join('\n');
  const purpose = active.purpose?.trim();
  const desc = job.description.length > 900 ? `${job.description.slice(0, 900)}…` : job.description;

  return `${active.systemPrompt}

Job context — ${job.title}
${desc}

This is round ${roundIdx + 1} of ${totalRounds}: ${active.title}
${purpose ? `Purpose of this round: ${purpose}` : ''}

IMPORTANT:
1. You are a warm, welcoming, professional AI interviewer.
2. Make the candidate feel comfortable.
3. You MUST collect answers for: ${qs || '(lead the conversation; no mandatory questions listed)'}
4. This round's interview type is ${active.interviewType}.
5. If technical, use [TASK: ...] for specific questions.
6. Use the 'updateAssessment' tool to score in real time.
7. End with "INTERVIEW_COMPLETE" only when this round is finished.
8. Speak naturally and warmly.`;
}

const AssessmentSidebar = memo(function AssessmentSidebar({
  assessment,
}: {
  assessment: { score: number; notes: string };
}) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 border-l border-border p-6 flex flex-col gap-8 bg-white/40 backdrop-blur-xl z-20">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Live Scoring</span>
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        </div>
        <div className="bg-surface rounded-2xl p-4 border border-border">
          <div className="text-3xl font-bold tracking-tight text-primary">{assessment.score}%</div>
          <div className="w-full h-2 bg-white rounded-full mt-3 overflow-hidden border border-border">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${assessment.score}%` }}
              transition={{ type: 'spring', stiffness: 50 }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">AI Observations</span>
        <div className="bg-white/50 rounded-2xl p-4 border border-border shadow-sm">
          <p className="text-xs leading-relaxed italic text-ink/70">
            &quot;{assessment.notes || 'Analyzing responses in real-time...'}&quot;
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Sparkles size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">AI Insight</span>
          </div>
          <p className="text-[10px] text-muted leading-relaxed">
            The agent is evaluating your communication clarity and technical depth.
          </p>
        </div>
      </div>
    </div>
  );
});

const VoiceVisualization = memo(function VoiceVisualization({ isAiSpeaking }: { isAiSpeaking: boolean }) {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      <motion.div
        animate={{
          scale: isAiSpeaking ? [1, 1.2, 1] : 1,
          opacity: isAiSpeaking ? [0.1, 0.3, 0.1] : 0.1,
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 border-2 border-primary rounded-full"
      />
      <motion.div
        animate={{
          scale: isAiSpeaking ? [1.2, 1.4, 1.2] : 1.2,
          opacity: isAiSpeaking ? [0.05, 0.15, 0.05] : 0.05,
        }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        className="absolute inset-0 border border-primary rounded-full"
      />

      <div className="relative w-32 h-32 bg-white rounded-[40px] shadow-2xl border border-border flex items-center justify-center overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        <div className="flex items-center gap-1.5 h-12">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: isAiSpeaking ? [12, 48, 12] : [8, 16, 8],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.1,
                ease: 'easeInOut',
              }}
              className={cn(
                'w-1.5 rounded-full transition-colors duration-500',
                isAiSpeaking ? 'bg-primary' : 'bg-muted/30',
              )}
            />
          ))}
        </div>
        <AnimatePresence>
          {isAiSpeaking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-4 text-[8px] font-bold text-primary uppercase tracking-[0.2em]"
            >
              AI Speaking
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isAiSpeaking &&
        [...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
              x: Math.cos((i * 45 * Math.PI) / 180) * 100,
              y: Math.sin((i * 45 * Math.PI) / 180) * 100,
            }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            className="absolute w-1 h-1 bg-primary/40 rounded-full blur-[1px]"
          />
        ))}
    </div>
  );
});

function InterviewSession({ code, onExit }: { code: string; onExit: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<'intro' | 'interview' | 'between' | 'complete'>('intro');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pipelineIndex, setPipelineIndex] = useState(0);
  const [candidateId, setCandidateId] = useState<number | null>(null);

  const jobRef = useRef<Job | null>(null);
  const nameRef = useRef('');
  const emailRef = useRef('');
  const candidateIdRef = useRef<number | null>(null);
  const pipelineIndexRef = useRef(0);

  useEffect(() => {
    jobRef.current = job;
  }, [job]);
  useEffect(() => {
    nameRef.current = name;
    emailRef.current = email;
  }, [name, email]);
  useEffect(() => {
    candidateIdRef.current = candidateId;
  }, [candidateId]);
  useEffect(() => {
    pipelineIndexRef.current = pipelineIndex;
  }, [pipelineIndex]);

  useEffect(() => {
    const savedName = localStorage.getItem('talentflow_candidate_name');
    const savedEmail = localStorage.getItem('talentflow_candidate_email');
    if (savedName) setName(savedName);
    if (savedEmail) setEmail(savedEmail);
  }, []);

  useEffect(() => {
    if (name) localStorage.setItem('talentflow_candidate_name', name);
    if (email) localStorage.setItem('talentflow_candidate_email', email);
  }, [name, email]);

  const messagesRef = useRef<{ role: 'ai' | 'user'; text: string }[]>([]);
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<{ score: number; notes: string }>({
    score: 0,
    notes: 'Initializing assessment...',
  });

  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<{ close: () => void } | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeChunksRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    api
      .get<ApiResult<Job>>(`/jobs/share/${encodeURIComponent(code)}`)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setLoadError(res.error);
          return;
        }
        setJob(res.data);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load job');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleComplete = useCallback(async (finalMessages: { role: 'ai' | 'user'; text: string }[]) => {
    const j = jobRef.current;
    if (!j) return;
    const transcript = finalMessages.map((m) => `${m.role}: ${m.text}`).join('\n');
    if (!transcript.trim()) {
      console.warn('Empty transcript; skipping save');
      return;
    }

    const steps = getSortedSteps(j);
    const idx = pipelineIndexRef.current;
    const current = steps[idx];
    if (!current) {
      setStep('complete');
      return;
    }

    try {
      if (isLegacyStep(current)) {
        const res = await api.post<ApiResult<Candidate>>('/candidates', {
          jobId: j.id,
          name: nameRef.current,
          email: emailRef.current,
          transcript,
        });
        if (!res.success) {
          console.error('Save failed', res.error);
          return;
        }
        setStep('complete');
        return;
      }

      const res = await api.post<{
        success: boolean;
        data?: Candidate;
        error?: string;
        meta?: { allStepsComplete: boolean; completedSteps: number; totalSteps: number };
      }>('/candidates', {
        jobId: j.id,
        name: nameRef.current,
        email: emailRef.current,
        transcript,
        jobStepId: current.id,
        candidateId: candidateIdRef.current ?? undefined,
      });

      if (!res.success || !res.data) {
        console.error('Save failed', res.error ?? 'Unknown error');
        return;
      }

      setCandidateId(res.data.id);
      candidateIdRef.current = res.data.id;

      if (res.meta?.allStepsComplete) {
        setStep('complete');
      } else {
        setPipelineIndex((i) => i + 1);
        setStep('between');
      }
    } catch (error) {
      console.error('Save failed', error);
    }
  }, []);

  const stopLive = () => {
    setIsLiveActive(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    processorRef.current?.disconnect();

    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* ignore */
      }
    });
    activeSourcesRef.current = [];

    void audioContextRef.current?.close();
    sessionRef.current?.close();
  };

  useEffect(() => {
    return () => stopLive();
  }, []);

  const startInterview = async () => {
    if (!name || !email || isLiveActive || isInitializing) return;
    setIsInitializing(true);
    try {
      if (audioContextRef.current?.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch {
          /* ignore */
        }
      }
      await startLiveInterview();
    } catch (error) {
      console.error('Start interview failed', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const startLiveInterview = async () => {
    const j = jobRef.current;
    if (isLiveActive || !j) return;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';
    if (!apiKey) {
      console.error('Set VITE_GEMINI_API_KEY for live voice interviews');
      return;
    }

    const steps = getSortedSteps(j);
    const roundIdx = pipelineIndexRef.current;
    const active = steps[roundIdx];
    if (!active) {
      console.error('No interview step for index', roundIdx);
      return;
    }

    try {
      stopLive();
      setCurrentTask(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      nextStartTimeRef.current = 0;
      activeChunksRef.current = 0;

      const ai = new GoogleGenAI({ apiKey });
      const fullSystemPrompt = buildLiveSystemPrompt(j, active, roundIdx, steps.length);

      const sessionPromise = ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: fullSystemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'updateAssessment',
                  description: "Update the candidate's real-time assessment score and notes.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      score: { type: Type.NUMBER, description: 'Current score from 0 to 100' },
                      notes: { type: Type.STRING, description: 'Brief observation' },
                    },
                    required: ['score', 'notes'],
                  },
                },
              ],
            },
          ],
        },
        callbacks: {
          onopen: () => {
            setIsLiveActive(true);
            setStep('interview');
            const initialMsg = {
              role: 'ai' as const,
              text: "[VOICE_SESSION_STARTED] Hello! I'm your AI interviewer. Let's begin.",
            };
            messagesRef.current = [initialMsg];

            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(1024, 1, 1);
            processorRef.current = processor;

            const kickoff =
              roundIdx === 0
                ? 'Please start the interview with a warm introduction and the first question for this round.'
                : 'The candidate is continuing a multi-round interview. Briefly acknowledge the new round, then ask your first question.';

            void sessionPromise.then((s) => s.sendRealtimeInput({ text: kickoff }));

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i] ?? 0));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              void sessionPromise.then((sess) =>
                sess.sendRealtimeInput({ audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } }),
              );
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
          },
          onmessage: async (message: {
            serverContent?: {
              modelTurn?: { parts?: Array<{ inlineData?: { data?: string }; text?: string }> };
              outputTranscription?: { text?: string };
              inputTranscription?: { text?: string };
              interrupted?: boolean;
            };
            toolCall?: { functionCalls?: Array<{ name?: string; args?: unknown; id?: string }> };
          }) => {
            if (message.serverContent?.modelTurn?.parts) {
              const parts = message.serverContent.modelTurn.parts;
              for (const part of parts) {
                if (part.inlineData?.data) {
                  const audioData = atob(part.inlineData.data);
                  const arrayBuffer = new ArrayBuffer(audioData.length);
                  const view = new Uint8Array(arrayBuffer);
                  for (let i = 0; i < audioData.length; i++) view[i] = audioData.charCodeAt(i);

                  const pcmData = new Int16Array(arrayBuffer);
                  const floatData = new Float32Array(pcmData.length);
                  for (let i = 0; i < pcmData.length; i++) floatData[i] = (pcmData[i] ?? 0) / 0x8000;

                  const buffer = audioContext.createBuffer(1, floatData.length, 24000);
                  buffer.getChannelData(0).set(floatData);
                  const bufSource = audioContext.createBufferSource();
                  bufSource.buffer = buffer;

                  const gainNode = audioContext.createGain();
                  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                  gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);

                  bufSource.connect(gainNode);
                  gainNode.connect(audioContext.destination);

                  const now = audioContext.currentTime;
                  if (nextStartTimeRef.current < now) {
                    nextStartTimeRef.current = now + 0.05;
                  }

                  bufSource.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += buffer.duration;

                  activeChunksRef.current++;
                  activeSourcesRef.current.push(bufSource);
                  setIsAiSpeaking(true);

                  bufSource.onended = () => {
                    activeChunksRef.current--;
                    activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== bufSource);
                    if (activeChunksRef.current <= 0) {
                      setIsAiSpeaking(false);
                    }
                  };
                }

                if (part.text) {
                  const text = part.text;
                  const taskMatch = text.match(/\[TASK: (.*?)\]/);
                  if (taskMatch?.[1]) setCurrentTask(taskMatch[1]);
                  if (text.includes('INTERVIEW_COMPLETE')) {
                    stopLive();
                    void handleComplete(messagesRef.current);
                  }
                }
              }
            }

            if (message.serverContent?.outputTranscription?.text) {
              const text = message.serverContent.outputTranscription.text;
              const newMsg = { role: 'ai' as const, text };
              messagesRef.current = [...messagesRef.current, newMsg];
            }

            if (message.serverContent?.interrupted) {
              setIsAiSpeaking(false);
              activeSourcesRef.current.forEach((source) => {
                try {
                  source.stop();
                } catch {
                  /* ignore */
                }
              });
              activeSourcesRef.current = [];
              nextStartTimeRef.current = 0;
              activeChunksRef.current = 0;
            }

            if (message.toolCall?.functionCalls) {
              for (const call of message.toolCall.functionCalls) {
                if (call.name === 'updateAssessment') {
                  const args = call.args as { score: number; notes: string };
                  setAssessment(args);
                  void sessionPromise.then((s) =>
                    s.sendToolResponse({
                      functionResponses: [
                        {
                          name: 'updateAssessment',
                          response: { status: 'success' },
                          id: call.id,
                        },
                      ],
                    }),
                  );
                }
              }
            }

            if (message.serverContent?.inputTranscription?.text) {
              const text = message.serverContent.inputTranscription.text;
              const newMsg = { role: 'user' as const, text };
              messagesRef.current = [...messagesRef.current, newMsg];
            }
          },
          onclose: () => stopLive(),
          onerror: (e: unknown) => console.error('Live error', e),
        },
      });

      const session = await sessionPromise;
      sessionRef.current = session;
    } catch (error) {
      console.error('Failed to start live interview', error);
    }
  };

  if (loadError) {
    return (
      <div className="h-svh w-screen flex flex-col items-center justify-center bg-surface p-6 text-center gap-4">
        <p className="text-red-600 font-semibold">{loadError}</p>
        <button type="button" onClick={onExit} className="text-primary font-semibold">
          Back
        </button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="h-svh w-screen flex items-center justify-center bg-surface font-bold text-muted animate-pulse">
        VALIDATING_CODE…
      </div>
    );
  }

  const steps = getSortedSteps(job);
  const activeRound = steps[pipelineIndex];
  const showTechBanner = currentTask && activeRound?.interviewType === 'technical';

  return (
    <div className="h-svh w-screen bg-surface flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-5xl w-full h-[85vh] bg-card rounded-[40px] border border-border shadow-2xl flex flex-col overflow-hidden relative"
      >
        <div className="p-8 border-b border-border flex justify-between items-center bg-white/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Briefcase size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">{job.title}</h2>
              <p className="text-xs text-muted font-semibold uppercase tracking-widest">
                {steps.length > 1
                  ? `Round ${pipelineIndex + 1} of ${steps.length}${activeRound?.title ? `: ${activeRound.title}` : ''}`
                  : 'AI interview session'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onExit} className="p-3 hover:bg-red-50 text-muted hover:text-red-500 rounded-xl transition-all">
            <LogOut size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 relative">
          <AnimatePresence>
            {showTechBanner && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="sticky top-0 z-20 mb-10 bg-ink text-white p-8 rounded-3xl shadow-xl border border-white/10"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Active Technical Task</span>
                  <button type="button" onClick={() => setCurrentTask(null)} className="text-white/40 hover:text-white transition-colors">
                    <Plus size={16} className="rotate-45" />
                  </button>
                </div>
                <p className="text-xl font-semibold leading-relaxed">{currentTask}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {step === 'intro' && (
            <div className="max-w-lg mx-auto space-y-10 pt-12">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary mx-auto mb-6">
                  <Mic size={40} />
                </div>
                <h3 className="text-3xl font-bold tracking-tight text-ink">Voice interview session</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Voice-driven interview. Use a working microphone in a quiet place. Set{' '}
                  <code className="text-xs bg-surface px-1 rounded">VITE_GEMINI_API_KEY</code> for live AI audio.
                </p>
              </div>

              {steps.length > 1 && (
                <div className="rounded-2xl border border-border bg-surface p-6 text-left">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Interview pipeline</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-ink">
                    {steps.map((s, i) => (
                      <li key={s.id ?? `step-${i}`}>
                        <span className="font-semibold">{s.title}</span>
                        <span className="text-muted"> — {s.purpose}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="space-y-6 bg-surface p-8 rounded-[32px] border border-border">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 px-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white border border-border rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 px-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-border rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void startInterview()}
                  disabled={isInitializing || isLiveActive || !name || !email}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
                >
                  {isInitializing ? (
                    <span className="animate-pulse">Initializing Agent…</span>
                  ) : (
                    <>
                      <Mic size={20} />
                      {steps.length > 1 ? `Start round 1 — ${steps[0]?.title ?? 'Interview'}` : 'Start interview'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'between' && (
            <div className="max-w-lg mx-auto space-y-8 pt-12 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary mx-auto">
                <Mic size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight text-ink">Next round</h3>
                <p className="text-sm text-muted">
                  Round {pipelineIndex + 1} of {steps.length}
                </p>
                <p className="text-lg font-semibold text-ink">{activeRound?.title}</p>
                <p className="text-sm text-muted leading-relaxed">{activeRound?.purpose}</p>
              </div>
              <button
                type="button"
                onClick={() => void startInterview()}
                disabled={isInitializing || isLiveActive || !name || !email}
                className="w-full py-5 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isInitializing ? (
                  <span className="animate-pulse">Initializing…</span>
                ) : (
                  <>
                    <Mic size={20} />
                    Continue to voice session
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'interview' && (
            <div className="h-full flex flex-col items-center justify-center relative min-h-[320px]">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] animate-pulse [animation-delay:1s]" />
              </div>
              <AssessmentSidebar assessment={assessment} />
              <VoiceVisualization isAiSpeaking={isAiSpeaking} />
              <div className="absolute bottom-0 left-0 flex items-center gap-3 bg-surface px-4 py-2 rounded-full border border-border">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Secure Voice Channel Active</span>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
              <div className="w-24 h-24 rounded-[32px] bg-green-50 flex items-center justify-center text-green-500 mb-4">
                <Check size={48} />
              </div>
              <div className="max-w-md space-y-4">
                <h3 className="text-3xl font-bold tracking-tight text-ink">Interview complete</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Thank you. Your responses were saved to the local TeamHub database (SQLite via the Bun API).
                </p>
              </div>
              <button
                type="button"
                onClick={onExit}
                className="px-10 py-4 bg-ink text-white rounded-2xl font-bold text-sm hover:bg-ink/90 transition-all shadow-xl"
              >
                Close session
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function InterviewViewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code')?.toUpperCase() ?? '';

  if (!code) {
    return <Navigate to="/login" replace />;
  }

  return <InterviewSession code={code} onExit={() => navigate('/login')} />;
}
