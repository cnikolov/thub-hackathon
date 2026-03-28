import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Briefcase,
  Check,
  ClipboardList,
  LogOut,
  Mic,
  MicOff,
  Volume2,
} from 'lucide-react';
import {
  FishjamProvider,
  useCamera,
  useConnection,
  useInitializeDevices,
  useMicrophone,
  usePeers,
  useVAD,
} from '@fishjam-cloud/react-client';
import { api, type ApiResult } from '../lib/api';
import type { Candidate, Job, JobInterviewStep } from '../lib/types';
import { cn } from '../lib/utils';

function getSortedSteps(job: Job): JobInterviewStep[] {
  const s = job.interviewSteps ?? [];
  return [...s].sort((a, b) => a.stepOrder - b.stepOrder);
}

type SessionData = {
  sessionId: string;
  peerToken: string;
  agentPeerId: string;
  fishjamId: string;
  totalSteps: number;
};

// ---------------------------------------------------------------------------
// Voice visualization
// ---------------------------------------------------------------------------
const VoiceVisualization = memo(function VoiceVisualization({ isAiSpeaking }: { isAiSpeaking: boolean }) {
  return (
    <div className="relative w-56 h-56 flex items-center justify-center">
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
      <div className="relative w-28 h-28 bg-white rounded-[36px] shadow-2xl border border-border flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        <div className="flex items-center gap-1.5 h-10">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ height: isAiSpeaking ? [10, 40, 10] : [6, 14, 6] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
              className={cn('w-1.5 rounded-full transition-colors duration-500', isAiSpeaking ? 'bg-primary' : 'bg-muted/30')}
            />
          ))}
        </div>
        <AnimatePresence>
          {isAiSpeaking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-3 text-[7px] font-bold text-primary uppercase tracking-[0.2em]"
            >
              Speaking
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
              x: Math.cos((i * 45 * Math.PI) / 180) * 80,
              y: Math.sin((i * 45 * Math.PI) / 180) * 80,
            }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            className="absolute w-1 h-1 bg-primary/40 rounded-full blur-[1px]"
          />
        ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Pre-interview device check
// ---------------------------------------------------------------------------
function DeviceCheck({
  onReady,
  brandColor,
  noiseGateThreshold,
  onNoiseGateChange,
}: {
  onReady: () => void;
  brandColor: string;
  noiseGateThreshold: number;
  onNoiseGateChange: (v: number) => void;
}) {
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [micLevel, setMicLevel] = useState(0);
  const [speakerTested, setSpeakerTested] = useState(false);
  const [playingTest, setPlayingTest] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        setMicPermission('granted');
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        function tick() {
          if (cancelled) return;
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setMicLevel(Math.min(1, avg / 80));
          rafRef.current = requestAnimationFrame(tick);
        }
        tick();
      } catch {
        if (!cancelled) setMicPermission('denied');
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function testSpeaker() {
    setPlayingTest(true);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.stop(ctx.currentTime + 0.8);
    setTimeout(() => { setPlayingTest(false); setSpeakerTested(true); }, 900);
  }

  const ready = micPermission === 'granted' && speakerTested;

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h3 className="text-lg font-bold text-ink">Check your devices</h3>
        <p className="text-xs text-muted mt-1">Make sure your microphone and speakers work before joining.</p>
      </div>

      {/* Microphone + Noise gate */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {micPermission === 'granted' ? <Mic size={16} className="text-green-500" /> : <MicOff size={16} className="text-red-400" />}
            <span className="text-sm font-semibold text-ink">Microphone</span>
          </div>
          <span className={cn('text-[10px] font-bold uppercase tracking-widest', micPermission === 'granted' ? 'text-green-600' : micPermission === 'denied' ? 'text-red-500' : 'text-amber-500')}>
            {micPermission === 'granted' ? 'Connected' : micPermission === 'denied' ? 'Blocked' : 'Requesting…'}
          </span>
        </div>

        {micPermission === 'granted' && (
          <>
            <p className="text-[11px] text-muted">Speak to see the bar move. {micLevel > 0.1 ? 'Looking good!' : 'Try saying something…'}</p>

            {/* Combined level bar with noise gate overlay */}
            <div className="relative h-4 bg-white rounded-full border border-border overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: micLevel > noiseGateThreshold ? '#22c55e' : '#ef4444' }}
                animate={{ width: `${Math.max(2, micLevel * 100)}%` }}
                transition={{ duration: 0.08 }}
              />
              <div className="absolute inset-y-0 w-0.5 bg-amber-500 z-10" style={{ left: `${noiseGateThreshold * 100}%` }} />
              <div className="absolute inset-y-0 left-0 bg-red-500/10 pointer-events-none" style={{ width: `${noiseGateThreshold * 100}%` }} />
            </div>

            {/* Noise gate slider */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold text-muted shrink-0 w-16">Gate: {Math.round(noiseGateThreshold * 100)}%</span>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={noiseGateThreshold}
                onChange={(e) => onNoiseGateChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500"
                style={{ background: `linear-gradient(to right, #fbbf24 ${noiseGateThreshold * 200}%, #e2e8f0 ${noiseGateThreshold * 200}%)` }}
              />
            </div>
            <p className="text-[10px] text-muted">
              {micLevel > 0 && micLevel <= noiseGateThreshold
                ? 'Background noise is gated — good!'
                : micLevel > noiseGateThreshold
                  ? 'Audio passing through'
                  : 'Set the slider just above your background noise level.'}
            </p>
          </>
        )}
        {micPermission === 'denied' && (
          <p className="text-[11px] text-red-500">Microphone access was denied. Please allow it in your browser settings and refresh.</p>
        )}
      </div>

      {/* Speaker */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 size={16} className={speakerTested ? 'text-green-500' : 'text-muted'} />
            <span className="text-sm font-semibold text-ink">Speakers</span>
          </div>
          {speakerTested && (
            <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Tested</span>
          )}
        </div>
        <button
          type="button"
          onClick={testSpeaker}
          disabled={playingTest}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Volume2 size={14} />
          {playingTest ? 'Playing…' : speakerTested ? 'Play again' : 'Test speakers'}
        </button>
        <p className="text-[11px] text-muted">You should hear a short tone. If not, check your volume and output device.</p>
      </div>

      <button
        type="button"
        onClick={onReady}
        disabled={!ready}
        className="w-full py-4 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-300"
        style={{ backgroundColor: ready ? brandColor : undefined, boxShadow: ready ? `0 8px 24px ${brandColor}33` : undefined }}
      >
        <Check size={18} />
        Devices ready — continue
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mic level meter — live audio level from Web Audio API
// ---------------------------------------------------------------------------
function MicLevelMeter({ stream, muted }: { stream: MediaStream | null; muted: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<{ analyser: AnalyserNode; data: Uint8Array<ArrayBuffer>; audioCtx: AudioContext; source: MediaStreamAudioSourceNode } | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!stream || muted) {
      if (ctxRef.current) {
        ctxRef.current.source.disconnect();
        ctxRef.current.audioCtx.close().catch(() => {});
        ctxRef.current = null;
      }
      cancelAnimationFrame(rafRef.current);
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) { ctx.clearRect(0, 0, c.width, c.height); }
      }
      return;
    }

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    ctxRef.current = { analyser, data, audioCtx, source };

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      const c = canvasRef.current;
      const a = ctxRef.current;
      if (!c || !a) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;

      a.analyser.getByteFrequencyData(a.data);
      const avg = a.data.reduce((sum, v) => sum + v, 0) / a.data.length;
      const level = Math.min(avg / 128, 1);

      const w = c.width;
      const h = c.height;
      ctx.clearRect(0, 0, w, h);

      const bars = 16;
      const gap = 2;
      const barW = (w - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        const threshold = i / bars;
        const active = level > threshold;
        ctx.fillStyle = active
          ? level > 0.7 ? '#ef4444' : level > 0.4 ? '#f59e0b' : '#22c55e'
          : 'rgba(148,163,184,0.15)';
        ctx.beginPath();
        ctx.roundRect(i * (barW + gap), 0, barW, h, 2);
        ctx.fill();
      }
    }
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      audioCtx.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [stream, muted]);

  return <canvas ref={canvasRef} width={128} height={16} className="h-4 w-32 rounded" />;
}

// ---------------------------------------------------------------------------
// Inner component that runs inside FishjamProvider (full-screen with sidebar)
// ---------------------------------------------------------------------------
function FishjamInterviewRoom({
  sessionData,
  steps,
  pipelineIndex,
  onInterviewComplete,
  onExit,
  noiseGateThreshold,
}: {
  sessionData: SessionData;
  steps: JobInterviewStep[];
  pipelineIndex: number;
  onInterviewComplete: (transcript: string | null) => void;
  onExit: () => void;
  noiseGateThreshold: number;
}) {
  const { joinRoom, leaveRoom, peerStatus } = useConnection();
  const { initializeDevices } = useInitializeDevices();
  const { stopMicrophone, isMicrophoneOn, toggleMicrophoneMute, isMicrophoneMuted, microphoneStream, setMicrophoneTrackMiddleware } = useMicrophone();
  const { cameraStream } = useCamera();
  const { remotePeers } = usePeers();
  type ChecklistItem = { id: string; label: string; required: boolean; covered: boolean };
  type Phase = 'intro' | 'objectives' | 'outro' | 'complete';
  const [isActive, setIsActive] = useState(false);
  const [assessment, setAssessment] = useState<{ score: number; notes: string }>({ score: 0, notes: '' });
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [showNotes, setShowNotes] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const onCompleteRef = useRef(onInterviewComplete);
  onCompleteRef.current = onInterviewComplete;
  const leaveRoomRef = useRef(leaveRoom);
  leaveRoomRef.current = leaveRoom;

  const aiUnlockedMicRef = useRef(false);

  const isMutedRef = useRef(isMicrophoneMuted);
  isMutedRef.current = isMicrophoneMuted;
  const toggleMicrophoneMuteRef = useRef(async (forceUnmute: boolean) => {
    if (forceUnmute && isMutedRef.current) {
      aiUnlockedMicRef.current = true;
      await toggleMicrophoneMute();
      api.post(`/rooms/interview-session/${sessionData.sessionId}/mic-muted`, { muted: false }).catch(() => {});
    }
  });
  toggleMicrophoneMuteRef.current = async (forceUnmute: boolean) => {
    if (forceUnmute && isMutedRef.current) {
      aiUnlockedMicRef.current = true;
      await toggleMicrophoneMute();
      api.post(`/rooms/interview-session/${sessionData.sessionId}/mic-muted`, { muted: false }).catch(() => {});
    }
  };

  // Enforce mute the instant the mic comes alive — keeps it muted until
  // the AI explicitly calls promptCandidate to unlock it.
  useEffect(() => {
    if (aiUnlockedMicRef.current) return;
    if (isMicrophoneOn && !isMicrophoneMuted) {
      toggleMicrophoneMute();
      api.post(`/rooms/interview-session/${sessionData.sessionId}/mic-muted`, { muted: true }).catch(() => {});
    }
  }, [isMicrophoneOn, isMicrophoneMuted]); // eslint-disable-line react-hooks/exhaustive-deps

  const agentPeer = remotePeers.find((p) => (p.id as string) === sessionData.agentPeerId);
  const agentPeerIds = useMemo(() => (agentPeer ? [agentPeer.id] : []), [agentPeer?.id]);
  const vadInfo = useVAD({ peerIds: agentPeerIds });
  const isAiSpeaking = agentPeer ? (vadInfo[agentPeer.id] ?? false) : false;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const agentTrack = agentPeer?.microphoneTrack ?? agentPeer?.tracks[0] ?? null;
  const agentStream = agentTrack?.stream ?? null;
  useEffect(() => {
    if (agentStream && audioRef.current) {
      audioRef.current.srcObject = agentStream;
      audioRef.current.play().catch(() => {});
    }
    return () => { if (audioRef.current) audioRef.current.srcObject = null; };
  }, [agentStream]);

  const cameraRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.srcObject = cameraStream ?? null;
  }, [cameraStream]);

  // Noise gate threshold ref — updated live so the audio worklet reads the latest value
  const thresholdRef = useRef(noiseGateThreshold);
  useEffect(() => { thresholdRef.current = noiseGateThreshold; }, [noiseGateThreshold]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initializeDevices({ enableAudio: true, enableVideo: true });
        if (cancelled) return;

        // Apply noise gate middleware before joining
        await setMicrophoneTrackMiddleware((track: MediaStreamTrack) => {
          const ctx = new AudioContext();
          const source = ctx.createMediaStreamSource(new MediaStream([track]));
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.5;
          const gain = ctx.createGain();
          const dest = ctx.createMediaStreamDestination();

          source.connect(analyser);
          analyser.connect(gain);
          gain.connect(dest);

          const freqData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
          let rafId: number;

          function gate() {
            rafId = requestAnimationFrame(gate);
            analyser.getByteFrequencyData(freqData);
            const avg = freqData.reduce((a, b) => a + b, 0) / freqData.length;
            const level = avg / 128;
            const target = level > thresholdRef.current ? 1 : 0;
            gain.gain.setTargetAtTime(target, ctx.currentTime, 0.015);
          }
          gate();

          return {
            track: dest.stream.getAudioTracks()[0],
            onClear: () => {
              cancelAnimationFrame(rafId);
              source.disconnect();
              gain.disconnect();
              analyser.disconnect();
              ctx.close().catch(() => {});
            },
          };
        });
        if (cancelled) return;

        // Mute BEFORE joining so no audio leaks into the room
        await toggleMicrophoneMute();
        api.post(`/rooms/interview-session/${sessionData.sessionId}/mic-muted`, { muted: true }).catch(() => {});

        await joinRoom({ peerToken: sessionData.peerToken });
        if (cancelled) return;

        await api.post(`/rooms/interview-session/${sessionData.sessionId}/start`, { stepIndex: pipelineIndex });
        if (cancelled) return;
        setIsActive(true);
      } catch (err) {
        if (!cancelled) console.error('Failed to join room:', err);
      }
    })();
    return () => {
      cancelled = true;
      stopMicrophone();
      leaveRoom();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll session status (setTimeout chaining to avoid stacking)
  useEffect(() => {
    if (!isActive) return;

    function poll() {
      pollingRef.current = setTimeout(async () => {
        try {
          const res = await api.get<ApiResult<{ status: string; transcript: string | null; phase?: Phase; assessment?: { score: number; notes: string }; checklist?: ChecklistItem[]; unmuteRequested?: boolean }>>(`/rooms/interview-session/${sessionData.sessionId}`);
          if (res.success) {
            if (res.data.assessment) setAssessment(res.data.assessment);
            if (res.data.checklist) setChecklist(res.data.checklist);
            if (res.data.phase) setPhase(res.data.phase);

            // AI requested unmute — automatically unmute the candidate
            if (res.data.unmuteRequested) {
              console.log('[Interview] AI requested unmute — unlocking mic');
              toggleMicrophoneMuteRef.current(true);
            }

            if (res.data.status === 'complete') {
              completedRef.current = true;
              leaveRoomRef.current();
              onCompleteRef.current(res.data.transcript);
              return;
            }
          }
        } catch { /* keep polling */ }
        poll();
      }, 1500);
    }
    poll();

    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [isActive, sessionData.sessionId]);

  const activeRound = steps[pipelineIndex];

  return (
    <div className="fixed inset-0 z-50 bg-surface flex">
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Main interview area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-14 px-6 flex items-center justify-between border-b border-border bg-white/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <img src="/hackatron-project-logo.png" alt="Logo" className="w-8 h-8 rounded-xl object-contain" />
            <div>
              <p className="text-sm font-bold text-ink leading-tight">{activeRound?.title ?? 'Interview'}</p>
              <p className="text-[10px] text-muted">
                {steps.length > 1 ? `Round ${pipelineIndex + 1} of ${steps.length}` : 'Interview session'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className={cn('p-2 rounded-xl transition-colors', showNotes ? 'bg-primary/10 text-primary' : 'text-muted hover:text-ink')}
              title="Toggle notes panel"
            >
              <ClipboardList size={18} />
            </button>
            <button type="button" onClick={onExit} className="p-2 hover:bg-red-50 text-muted hover:text-red-500 rounded-xl transition-all" aria-label="Leave">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Center: voice visualization */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
          </div>
          <VoiceVisualization isAiSpeaking={isAiSpeaking} />
          <p className="mt-6 text-sm font-medium text-muted">
            {peerStatus !== 'connected'
              ? 'Connecting…'
              : isAiSpeaking
                ? isMicrophoneMuted ? 'AI is introducing — you\'ll be unmuted shortly' : 'AI is speaking…'
                : isMicrophoneMuted
                  ? 'Muted — click the mic button when ready to speak'
                  : 'Listening…'}
          </p>

          {/* Self-view camera PiP */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="absolute bottom-6 left-6 w-44 aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border-2 border-white/60 bg-black"
          >
            <video
              ref={cameraRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
            {!cameraStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink/80">
                <span className="text-[10px] font-semibold text-white/60">Camera off</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Bottom bar */}
        <div className="h-20 px-6 flex items-center justify-between border-t border-border bg-white/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn('w-2.5 h-2.5 rounded-full animate-pulse', peerStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500')} />
            <span className="text-xs font-semibold text-muted">
              {peerStatus === 'connected' ? 'Connected' : 'Connecting…'}
            </span>
          </div>

          {/* Mic controls — center */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={async () => {
                await toggleMicrophoneMute();
                const nowMuted = !isMicrophoneMuted;
                api.post(`/rooms/interview-session/${sessionData.sessionId}/mic-muted`, { muted: nowMuted }).catch(() => {});
              }}
              className={cn(
                'relative flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-md',
                isMicrophoneMuted
                  ? 'bg-red-50 text-red-600 ring-2 ring-red-200 hover:bg-red-100'
                  : 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200 hover:bg-emerald-100',
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                isMicrophoneMuted ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white',
              )}>
                {isMicrophoneMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs leading-tight">{isMicrophoneMuted ? 'Muted' : 'Live'}</span>
                <span className="text-[10px] font-medium opacity-60">{isMicrophoneMuted ? 'Click to unmute' : 'Click to mute'}</span>
              </div>
            </button>

            {/* Level meter */}
            {isMicrophoneOn && (
              <div className="flex flex-col items-center gap-1">
                <MicLevelMeter stream={microphoneStream} muted={isMicrophoneMuted} />
                <span className="text-[9px] font-semibold text-muted/60 uppercase tracking-wider">Level</span>
              </div>
            )}
          </div>

          {/* AI speaking indicator — right */}
          <div className="flex items-center gap-2">
            {isAiSpeaking && (
              <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full">
                <Volume2 size={12} className="text-primary animate-pulse" />
                <span className="text-[10px] font-bold text-primary">AI SPEAKING</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes sidebar */}
      <AnimatePresence>
        {showNotes && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-border bg-white overflow-hidden shrink-0"
          >
            <div className="w-[340px] h-full flex flex-col">
              <div className="p-5 border-b border-border">
                <h3 className="text-sm font-bold text-ink">Interview progress</h3>
                <p className="text-[10px] text-muted mt-0.5">Live tracking (not visible to candidate)</p>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Phase progress */}
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Current phase</p>
                  {(() => {
                    const phases: { key: typeof phase; label: string; color: string; dotActive: string; dotDone: string }[] = [
                      { key: 'intro', label: 'Intro', color: 'text-emerald-600', dotActive: 'bg-emerald-500', dotDone: 'bg-emerald-500' },
                      { key: 'objectives', label: 'Objectives', color: 'text-primary', dotActive: 'bg-primary', dotDone: 'bg-primary' },
                      { key: 'outro', label: 'Outro', color: 'text-amber-600', dotActive: 'bg-amber-500', dotDone: 'bg-amber-500' },
                    ];
                    const order = ['intro', 'objectives', 'outro', 'complete'] as const;
                    const currentIdx = order.indexOf(phase);

                    return (
                      <div className="flex items-center gap-0">
                        {phases.map((p, i) => {
                          const phaseIdx = order.indexOf(p.key);
                          const isDone = currentIdx > phaseIdx;
                          const isActive = currentIdx === phaseIdx;
                          return (
                            <div key={p.key} className="flex items-center flex-1">
                              <div className="flex flex-col items-center flex-1">
                                <div className={cn(
                                  'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500',
                                  isDone ? `${p.dotDone} text-white` : isActive ? `${p.dotActive} text-white ring-4 ring-opacity-20 ${p.key === 'intro' ? 'ring-emerald-500' : p.key === 'objectives' ? 'ring-primary' : 'ring-amber-500'}` : 'bg-border/60 text-muted',
                                )}>
                                  {isDone ? <Check size={14} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                                </div>
                                <span className={cn(
                                  'text-[10px] font-bold mt-1.5 transition-colors duration-300',
                                  isDone || isActive ? p.color : 'text-muted/50',
                                )}>
                                  {p.label}
                                </span>
                              </div>
                              {i < phases.length - 1 && (
                                <div className={cn('h-0.5 w-full -mt-4 transition-all duration-500', isDone ? p.dotDone : 'bg-border/40')} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Score */}
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Score</p>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-bold text-ink">{assessment.score}</span>
                    <span className="text-sm text-muted mb-1">/ 100</span>
                  </div>
                  <div className="mt-2 h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${assessment.score}%`, backgroundColor: assessment.score >= 70 ? '#22c55e' : assessment.score >= 40 ? '#eab308' : '#ef4444' }}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Latest observation</p>
                  <p className="text-sm text-ink leading-relaxed">
                    {assessment.notes || 'Waiting for the conversation to begin…'}
                  </p>
                </div>

                {/* Checklist — only completed items, no totals or hints */}
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Covered so far</p>
                  <div className="space-y-1">
                    {checklist.filter((c) => c.covered).length === 0 ? (
                      <p className="text-xs text-muted italic px-1">Nothing covered yet…</p>
                    ) : (
                      checklist.filter((c) => c.covered).map((c) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-green-50"
                        >
                          <span className="w-4 h-4 rounded border-2 border-green-500 bg-green-500 text-white flex items-center justify-center shrink-0">
                            <Check size={10} />
                          </span>
                          <span className="truncate text-green-700">{c.label}</span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pre-interview lobby with device check
// ---------------------------------------------------------------------------
function PreInterviewLobby({
  job,
  steps,
  name,
  email,
  onNameChange,
  onEmailChange,
  onStart,
  joining,
  noiseGateThreshold,
  onNoiseGateChange,
}: {
  job: Job;
  steps: JobInterviewStep[];
  name: string;
  email: string;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onStart: () => void;
  joining: boolean;
  noiseGateThreshold: number;
  onNoiseGateChange: (v: number) => void;
}) {
  const [phase, setPhase] = useState<'form' | 'devices'>('form');
  const ready = !!name.trim() && !!email.trim();
  const brandColor = '#001A72';

  if (phase === 'devices') {
    return (
      <div className="h-full flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
        <div className="lg:w-[340px] shrink-0 space-y-6">
          <div className="flex items-center gap-3">
            <img src="/hackatron-project-logo.png" alt="Logo" className="w-10 h-10 rounded-xl object-contain" />
            <div className="min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-ink truncate">{job.title}</h3>
              <p className="text-xs text-muted">Voice interview{steps.length > 1 ? ` · ${steps.length} rounds` : ''}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Ready to join</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{name}</p>
                <p className="text-[11px] text-muted">{email}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-start justify-center lg:pt-4">
          <div className="w-full max-w-sm bg-surface p-6 rounded-[28px] border border-border">
            <DeviceCheck onReady={onStart} brandColor={brandColor} noiseGateThreshold={noiseGateThreshold} onNoiseGateChange={onNoiseGateChange} />
          </div>
        </div>
      </div>
    );
  }

  const btnStyle = {
    backgroundColor: ready ? brandColor : undefined,
    boxShadow: ready ? `0 8px 24px ${brandColor}33` : undefined,
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
      <div className="lg:w-[340px] shrink-0 space-y-6">
        <div className="flex items-center gap-3">
          <img src="/hackatron-project-logo.png" alt="Logo" className="w-10 h-10 rounded-xl object-contain" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold tracking-tight text-ink truncate">{job.title}</h3>
            <p className="text-xs text-muted">Voice interview{steps.length > 1 ? ` · ${steps.length} rounds` : ''}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest">In this interview</p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Mic size={18} />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-surface" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">AI Interview Assistant</p>
              <p className="text-[11px] text-green-600 font-medium">Online — ready</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-muted font-bold text-sm">
                {name ? name.charAt(0).toUpperCase() : '?'}
              </div>
              {ready ? (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-surface" />
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-300 rounded-full border-2 border-surface" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{name || 'You'}</p>
              <p className="text-[11px] text-muted font-medium">
                {ready ? 'Ready to join' : 'Fill in your details to join'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">What to expect</p>
          {steps.length > 1 ? (
            <ol className="space-y-2 text-sm">
              {steps.map((s, i) => (
                <li key={s.id ?? `step-${i}`} className="flex items-baseline gap-2">
                  <span className="w-5 h-5 rounded-lg text-[10px] font-bold flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                    {i + 1}
                  </span>
                  <span className="font-medium text-ink">{s.title}</span>
                  {s.durationMinutes ? <span className="text-xs text-muted ml-auto">~{s.durationMinutes}m</span> : null}
                </li>
              ))}
            </ol>
          ) : (
            <ul className="space-y-2 text-sm text-muted">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" />Voice conversation with an AI assistant</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" />~{steps[0]?.durationMinutes ?? 15} minutes</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" />Microphone required</li>
            </ul>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center lg:pt-4">
        <div className="w-full max-w-sm space-y-5 bg-surface p-6 rounded-[28px] border border-border">
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Join as</p>
            <p className="text-xs text-muted">Your name and email are shared with the hiring team.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 px-1">Full name</label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 px-1">Email address</label>
              <input
                type="email"
                placeholder="e.g. john@example.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-primary/50 transition-all"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPhase('devices')}
            disabled={!ready || joining}
            className="w-full py-4 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:shadow-none disabled:bg-gray-300"
            style={btnStyle}
          >
            {joining ? (
              <span className="animate-pulse">Connecting…</span>
            ) : (
              <>
                <Mic size={18} />
                {steps.length > 1 ? `Continue to device check` : 'Continue to device check'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared confetti burst helper
// ---------------------------------------------------------------------------
function fireConfetti(durationMs = 3_000) {
  const end = Date.now() + durationMs;
  const colors = ['#14b8a6', '#0d9488', '#2dd4bf', '#fbbf24', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6'];

  function frame() {
    confetti({ particleCount: 100, angle: 60, spread: 80, origin: { x: 0, y: 0.6 }, colors, gravity: 0.8 });
    confetti({ particleCount: 100, angle: 120, spread: 80, origin: { x: 1, y: 0.6 }, colors, gravity: 0.8 });
    if (Date.now() < end) requestAnimationFrame(frame);
  }
  frame();

  // Big center cannon after a short delay
  setTimeout(() => {
    confetti({ particleCount: 200, spread: 160, startVelocity: 45, origin: { x: 0.5, y: 0.4 }, colors, gravity: 0.6 });
  }, 400);
}

// ---------------------------------------------------------------------------
// Round complete screen with confetti
// ---------------------------------------------------------------------------
function RoundCompleteScreen({ pipelineIndex, activeRound, onContinue, disabled }: {
  pipelineIndex: number;
  activeRound: JobInterviewStep | undefined;
  onContinue: () => void;
  disabled: boolean;
}) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    fireConfetti(2_500);
  }, []);

  return (
    <div className="max-w-lg mx-auto space-y-8 pt-8 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 12 }}
      >
        <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-[32px] flex items-center justify-center text-white mx-auto shadow-2xl shadow-green-500/30">
          <Check size={48} strokeWidth={3} />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
        <h3 className="text-3xl font-extrabold tracking-tight text-ink">Round {pipelineIndex} complete!</h3>
        <p className="text-sm text-muted max-w-sm mx-auto">Great work! When you&apos;re ready, continue to the next part.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="rounded-2xl border border-border bg-surface p-6 space-y-1 text-left">
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Up next</p>
        <p className="text-lg font-semibold text-ink">{activeRound?.title}</p>
        {activeRound?.durationMinutes && <p className="text-xs text-muted">~{activeRound.durationMinutes} minutes</p>}
      </motion.div>

      <motion.button
        type="button"
        onClick={onContinue}
        disabled={disabled}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="w-full py-5 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/20 disabled:opacity-50"
      >
        <Mic size={20} />
        Continue interview
      </motion.button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Final completion screen with confetti + company logo
// ---------------------------------------------------------------------------
function CompletionScreen({ onExit }: { onExit: () => void }) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    fireConfetti(3_500);
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center text-center space-y-10 relative overflow-hidden">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
      >
        <img
          src="/hackatron-project-logo.png"
          alt="Company Logo"
          className="w-28 h-28 rounded-[32px] object-contain shadow-2xl ring-4 ring-white/80"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="max-w-md space-y-4"
      >
        <h3 className="text-4xl font-extrabold tracking-tight text-ink">
          You&apos;re all done!
        </h3>
        <p className="text-muted text-sm leading-relaxed">
          Thank you for taking the time to interview with us. Your responses have been recorded and the team will review them shortly. We&apos;ll be in touch with next steps!
        </p>
      </motion.div>

      <motion.button
        type="button"
        onClick={onExit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="px-12 py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-2xl font-bold text-sm shadow-xl hover:shadow-2xl transition-shadow"
      >
        Finish
      </motion.button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main InterviewSession component
// ---------------------------------------------------------------------------
function InterviewSession({ code, onExit }: { code: string; onExit: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uiPhase, setUiPhase] = useState<'intro' | 'connecting' | 'interview' | 'between' | 'complete'>('intro');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pipelineIndex, setPipelineIndex] = useState(0);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [candidateId, setCandidateId] = useState<number | null>(null);
  const [noiseGateThreshold, setNoiseGateThreshold] = useState(0.08);
  const attendanceIdRef = useRef<number | null>(null);
  const completedNormallyRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('talentflow_candidate_name');
    const savedEmail = localStorage.getItem('talentflow_candidate_email');
    if (saved) setName(saved);
    if (savedEmail) setEmail(savedEmail);
  }, []);

  useEffect(() => {
    if (name) localStorage.setItem('talentflow_candidate_name', name);
    if (email) localStorage.setItem('talentflow_candidate_email', email);
  }, [name, email]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    api
      .get<ApiResult<Job>>(`/jobs/share/${encodeURIComponent(code)}`)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) { setLoadError(res.error); return; }
        setJob(res.data);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this interview. Please check your code and try again.');
      });
    return () => { cancelled = true; };
  }, [code]);

  const startInterview = useCallback(async () => {
    if (!name || !email || !job) return;
    setUiPhase('connecting');
    try {
      const res = await api.post<ApiResult<SessionData>>('/rooms/interview-session', {
        shareCode: code,
        name,
        email,
        stepIndex: pipelineIndex,
      });
      if (!res.success) {
        console.error('Session creation failed:', res.error);
        setUiPhase('intro');
        return;
      }
      completedNormallyRef.current = false;
      setSessionData(res.data);
      setUiPhase('interview');
      api
        .post<ApiResult<{ id: number }>>(`/jobs/share/${encodeURIComponent(code)}/attendance`, {
          name,
          email,
          round: pipelineIndex + 1,
        })
        .then((a) => { if (a.success) attendanceIdRef.current = a.data.id; })
        .catch(() => {});
    } catch (err) {
      console.error('Session creation error:', err);
      setUiPhase('intro');
    }
  }, [name, email, job, code, pipelineIndex]);

  const handleInterviewComplete = useCallback(
    async (transcript: string | null) => {
      completedNormallyRef.current = true;
      if (!job) return;
      const steps = getSortedSteps(job);
      const currentStep = steps[pipelineIndex];

      if (transcript?.trim()) {
        try {
          const payload: Record<string, unknown> = { jobId: job.id, name, email, transcript };
          if (currentStep?.id != null) payload.jobStepId = currentStep.id;
          if (candidateId != null) payload.candidateId = candidateId;
          const res = await api.post<{
            success: boolean;
            data?: Candidate;
            meta?: { allStepsComplete: boolean; completedSteps: number; totalSteps: number };
          }>('/candidates', payload);

          if (res.success && res.data) {
            setCandidateId(res.data.id);
            if (res.meta && !res.meta.allStepsComplete && pipelineIndex < steps.length - 1) {
              setPipelineIndex((i) => i + 1);
              setSessionData(null);
              setUiPhase('between');
              return;
            }
          }
        } catch (err) {
          console.error('Save failed', err);
        }
      }

      if (attendanceIdRef.current) {
        api.patch(`/jobs/attendance/${attendanceIdRef.current}/complete`, {}).catch(() => {});
      }
      setSessionData(null);
      setUiPhase('complete');
    },
    [job, pipelineIndex, name, email, candidateId],
  );

  useEffect(() => {
    return () => {
      if (sessionData && !completedNormallyRef.current) {
        void api.delete(`/rooms/interview-session/${sessionData.sessionId}`).catch(() => {});
      }
    };
  }, [sessionData?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) {
    return (
      <div className="h-svh w-screen flex flex-col items-center justify-center bg-surface p-6 text-center gap-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-400 mx-auto mb-2">
          <Briefcase size={28} />
        </div>
        <h3 className="text-xl font-bold text-ink">Interview not found</h3>
        <p className="text-sm text-muted max-w-sm">
          We couldn&apos;t find an interview with that code. Double-check the code from your invitation and try again.
        </p>
        <button type="button" onClick={onExit} className="mt-4 px-8 py-3 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary-hover transition-all">
          Try another code
        </button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="h-svh w-screen flex flex-col items-center justify-center bg-surface gap-3">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted font-medium">Loading your interview…</p>
      </div>
    );
  }

  const steps = getSortedSteps(job);
  const activeRound = steps[pipelineIndex];

  return (
    <div className="h-svh w-screen bg-surface flex items-center justify-center p-6">
      {/* Full-screen interview overlay */}
      {uiPhase === 'interview' && sessionData && (
        <FishjamProvider fishjamId={sessionData.fishjamId}>
          <FishjamInterviewRoom
            sessionData={sessionData}
            steps={steps}
            pipelineIndex={pipelineIndex}
            onInterviewComplete={handleInterviewComplete}
            onExit={onExit}
            noiseGateThreshold={noiseGateThreshold}
          />
        </FishjamProvider>
      )}

      {/* Non-interview phases in a card */}
      {uiPhase !== 'interview' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-5xl w-full h-[85vh] bg-card rounded-[40px] border border-border shadow-2xl flex flex-col overflow-hidden relative"
        >
          {uiPhase !== 'intro' && (
            <div className="p-8 border-b border-border flex justify-between items-center bg-white/50 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <img src="/hackatron-project-logo.png" alt="Logo" className="w-12 h-12 rounded-2xl object-contain" />
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-ink">{job.title}</h2>
                  <p className="text-xs text-muted font-semibold uppercase tracking-widest">
                    {steps.length > 1
                      ? `Round ${pipelineIndex + 1} of ${steps.length}${activeRound?.title ? ` — ${activeRound.title}` : ''}`
                      : 'Interview session'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onExit} className="p-3 hover:bg-red-50 text-muted hover:text-red-500 rounded-xl transition-all" aria-label="Leave">
                <LogOut size={20} />
              </button>
            </div>
          )}

          <div className={cn('flex-1 overflow-y-auto relative', uiPhase === 'intro' ? 'p-6 lg:p-8' : 'p-10')}>
            {uiPhase === 'intro' && (
              <PreInterviewLobby
                job={job}
                steps={steps}
                name={name}
                email={email}
                onNameChange={setName}
                onEmailChange={setEmail}
                onStart={() => void startInterview()}
                joining={false}
                noiseGateThreshold={noiseGateThreshold}
                onNoiseGateChange={setNoiseGateThreshold}
              />
            )}

            {uiPhase === 'connecting' && (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted font-medium animate-pulse">Setting up your interview…</p>
              </div>
            )}

            {uiPhase === 'between' && <RoundCompleteScreen pipelineIndex={pipelineIndex} activeRound={activeRound} onContinue={() => void startInterview()} disabled={!name || !email} />}

            {uiPhase === 'complete' && <CompletionScreen onExit={onExit} />}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing page (no code in URL)
// ---------------------------------------------------------------------------
function InterviewLanding() {
  const [codeInput, setCodeInput] = useState('');
  const navigate = useNavigate();

  function submit(e: FormEvent) {
    e.preventDefault();
    const c = codeInput.trim().toUpperCase();
    if (!c) return;
    navigate(`/interview?code=${encodeURIComponent(c)}`);
  }

  return (
    <div className="min-h-svh w-full flex flex-col items-center justify-center bg-surface p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-card rounded-[40px] p-10 sm:p-12 card-shadow border border-border"
      >
        <img src="/hackatron-project-logo.png" alt="Logo" className="w-16 h-16 rounded-2xl object-contain mx-auto mb-8" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink text-center mb-2">Open interview</h1>
        <p className="text-muted text-sm text-center mb-8 leading-relaxed">
          Enter the interview code from your invitation email to get started.
          Make sure you have a working microphone and are in a quiet environment.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="share-code" className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 px-1">
              Interview code
            </label>
            <input
              id="share-code"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Enter your code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              className="w-full bg-surface border border-border rounded-2xl px-4 py-4 text-sm font-mono font-semibold tracking-wider text-ink outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40"
            />
          </div>
          <button
            type="submit"
            disabled={!codeInput.trim()}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
          >
            Continue
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-8">
          Are you part of the hiring team?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function InterviewViewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code')?.trim().toUpperCase() ?? '';

  if (!code) return <InterviewLanding />;
  return <InterviewSession code={code} onExit={() => navigate('/interview', { replace: true })} />;
}
