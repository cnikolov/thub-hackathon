import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronDown, ChevronUp, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api, type ApiResult } from '../../lib/api';
import type { Job, Question } from '../../lib/types';
import { cn } from '../../lib/utils';

type ChecklistItemDraft = { id: string; label: string; required: boolean };

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function newRoundId() {
  return `r-${Math.random().toString(36).slice(2, 11)}`;
}

type InterviewRoundDraft = {
  id: string;
  title: string;
  purpose: string;
  interviewType: 'intro' | 'technical';
  durationMinutes: number;
  systemPrompt: string;
  introPrompt: string;
  outroPrompt: string;
  questions: Question[];
  checklist: ChecklistItemDraft[];
};

const DEFAULT_CHECKLIST: ChecklistItemDraft[] = [
  { id: 'cl-availability', label: 'Availability & notice period', required: true },
  { id: 'cl-salary', label: 'What are your salary expectations?', required: true },
  { id: 'cl-remote', label: 'Are you open to remote / hybrid / on-site?', required: true },
];

const DEFAULT_INTRO_PROMPT = `1. Greet the candidate warmly. Introduce yourself as the AI interview assistant.
2. Confirm their name.
3. Give a one-sentence overview of what this round covers.
4. Ask if they have any quick questions before you begin.`;

const DEFAULT_OUTRO_PROMPT = `1. Signal the wind-down: "Great conversation — we're wrapping up!"
2. Give brief positive feedback on one specific thing.
3. Ask if they have any questions about the role or team.
4. Thank them warmly and end the session.`;

function defaultRound(overrides: Partial<InterviewRoundDraft> = {}): InterviewRoundDraft {
  return {
    id: newRoundId(),
    title: 'Round 1',
    purpose: '',
    interviewType: 'intro',
    durationMinutes: 15,
    systemPrompt: '',
    introPrompt: DEFAULT_INTRO_PROMPT,
    outroPrompt: DEFAULT_OUTRO_PROMPT,
    questions: [],
    checklist: [...DEFAULT_CHECKLIST],
    ...overrides,
  };
}

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

export function JobCreateModal({
  open,
  projectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: number;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [newJob, setNewJob] = useState({
    title: '',
    description: '',
    requirements: '',
  });
  const [interviewSteps, setInterviewSteps] = useState<InterviewRoundDraft[]>([defaultRound()]);
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function reset() {
    setNewJob({ title: '', description: '', requirements: '' });
    setInterviewSteps([defaultRound()]);
    setExpandedRoundId(null);
    setError(null);
  }

  function addRound() {
    const n = interviewSteps.length + 1;
    setInterviewSteps((prev) => [...prev, defaultRound({ title: `Round ${n}`, purpose: '' })]);
  }

  function removeRound(id: string) {
    if (interviewSteps.length <= 1) return;
    setInterviewSteps((prev) => prev.filter((r) => r.id !== id));
  }

  function moveRound(index: number, dir: -1 | 1) {
    setInterviewSteps((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }

  function updateRound(id: string, updates: Partial<InterviewRoundDraft>) {
    setInterviewSteps((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  function addQuestion(roundId: string) {
    setInterviewSteps((prev) =>
      prev.map((r) =>
        r.id === roundId
          ? {
              ...r,
              questions: [
                ...r.questions,
                {
                  id: Math.random().toString(36).substring(7),
                  text: '',
                  isMandatory: true,
                  possibleAnswers: [],
                },
              ],
            }
          : r,
      ),
    );
  }

  function removeQuestion(roundId: string, qid: string) {
    setInterviewSteps((prev) =>
      prev.map((r) => (r.id === roundId ? { ...r, questions: r.questions.filter((q) => q.id !== qid) } : r)),
    );
  }

  function updateQuestion(roundId: string, qid: string, updates: Partial<Question>) {
    setInterviewSteps((prev) =>
      prev.map((r) =>
        r.id === roundId
          ? { ...r, questions: r.questions.map((q) => (q.id === qid ? { ...q, ...updates } : q)) }
          : r,
      ),
    );
  }

  function addChecklistItem(roundId: string) {
    setInterviewSteps((prev) =>
      prev.map((r) =>
        r.id === roundId
          ? { ...r, checklist: [...r.checklist, { id: `cl-${Math.random().toString(36).slice(2, 9)}`, label: '', required: true }] }
          : r,
      ),
    );
  }

  function removeChecklistItem(roundId: string, cid: string) {
    setInterviewSteps((prev) =>
      prev.map((r) => (r.id === roundId ? { ...r, checklist: r.checklist.filter((c) => c.id !== cid) } : r)),
    );
  }

  function updateChecklistItem(roundId: string, cid: string, updates: Partial<ChecklistItemDraft>) {
    setInterviewSteps((prev) =>
      prev.map((r) =>
        r.id === roundId
          ? { ...r, checklist: r.checklist.map((c) => (c.id === cid ? { ...c, ...updates } : c)) }
          : r,
      ),
    );
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsAnalyzing(true);
      let text = '';
      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else {
        text = await file.text();
      }
      setNewJob((prev) => ({ ...prev, description: text }));
    } catch (err) {
      console.error(err);
      setError('Could not read file');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleAnalyze() {
    if (!newJob.description.trim()) return;
    const first = interviewSteps[0];
    if (!first) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await api.post<
        ApiResult<{
          suggestedQuestions: { text: string; isMandatory: boolean; possibleAnswers?: string[] }[];
          durationMinutes: number;
          systemPrompt: string;
        }>
      >('/ai/analyze-job', {
        description: newJob.description,
        interviewType: first.interviewType,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      const suggestedQs = res.data.suggestedQuestions.map((q) => ({
        id: Math.random().toString(36).substring(7),
        text: q.text,
        isMandatory: q.isMandatory,
        possibleAnswers: q.possibleAnswers ?? [],
      }));
      setInterviewSteps((prev) => {
        const next = [...prev];
        const r0 = next[0];
        if (r0) {
          next[0] = {
            ...r0,
            systemPrompt: res.data.systemPrompt,
            durationMinutes: res.data.durationMinutes || 15,
            questions: suggestedQs.length ? suggestedQs : r0.questions,
          };
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleCreateJob(e: FormEvent) {
    e.preventDefault();
    if (!newJob.title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const stepsPayload = interviewSteps.map((s, i) => ({
        title: s.title.trim() || `Round ${i + 1}`,
        purpose: s.purpose.trim() || s.title.trim() || `Interview round ${i + 1}`,
        interviewType: s.interviewType,
        durationMinutes: s.durationMinutes,
        systemPrompt:
          s.systemPrompt.trim() ||
          'You are a professional AI interviewer. Be clear, fair, and conversational.',
        introPrompt: s.introPrompt.trim() || null,
        outroPrompt: s.outroPrompt.trim() || null,
        questions: s.questions.filter((q) => q.text.trim()),
        checklist: s.checklist.filter((c) => c.label.trim()),
      }));

      const first = stepsPayload[0]!;
      const res = await api.post<ApiResult<Job>>('/jobs', {
        title: newJob.title.trim(),
        description: newJob.description.trim() || '—',
        requirements: newJob.requirements.trim() || '—',
        projectId,
        systemPrompt: first.systemPrompt,
        interviewType: first.interviewType,
        questions: first.questions,
        durationMinutes: first.durationMinutes,
        status: 'open',
        interviewSteps: stepsPayload,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      reset();
      onClose();
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create job');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button type="button" className="absolute inset-0 bg-ink/20 backdrop-blur-md" aria-label="Close" onClick={() => !saving && onClose()} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-card rounded-[32px] p-10 w-full max-w-5xl shadow-2xl border border-border relative z-10 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-2xl font-bold tracking-tight text-ink mb-2">Create job position</h2>
        <p className="text-sm text-muted mb-8">Define the role and one or more interview rounds (e.g. technical screen, then offer conversation).</p>
        <form onSubmit={handleCreateJob}>
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2 px-1">Job title</label>
                <input
                  type="text"
                  value={newJob.title}
                  onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                  className="w-full bg-surface border border-border rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. Senior Product Designer"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2 px-1">
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest">Description</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Upload size={14} />
                    Import PDF
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,.txt"
                    className="hidden"
                  />
                </div>
                <textarea
                  value={newJob.description}
                  onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                  className="w-full bg-surface border border-border rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 h-56 resize-none"
                  placeholder="Describe the role and responsibilities…"
                />
                <div className="flex justify-end mt-4">
                  <button
                    type="button"
                    onClick={() => void handleAnalyze()}
                    disabled={isAnalyzing || !newJob.description.trim()}
                    className="text-xs font-bold text-primary flex items-center gap-2 hover:bg-primary/5 px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                  >
                    <Sparkles size={16} />
                    {isAnalyzing ? 'Analyzing…' : 'Generate AI prompt for round 1'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2 px-1">Requirements</label>
                <textarea
                  value={newJob.requirements}
                  onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })}
                  className="w-full bg-surface border border-border rounded-2xl p-4 text-sm outline-none h-24 resize-none"
                  placeholder="Key requirements (skills, experience)…"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="block text-xs font-bold text-muted uppercase tracking-widest">Interview rounds</label>
                <button
                  type="button"
                  onClick={addRound}
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  <Plus size={14} />
                  Add round
                </button>
              </div>

              <div className="space-y-3 max-h-[min(520px,55vh)] overflow-y-auto pr-1">
                {interviewSteps.map((round, idx) => {
                  const isOpen = expandedRoundId === null ? idx === 0 : expandedRoundId === round.id;
                  return (
                    <div key={round.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedRoundId(isOpen ? '__none__' : round.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/60 transition-colors"
                      >
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-ink text-sm truncate flex-1">
                          {round.title.trim() || `Round ${idx + 1}`}
                        </span>
                        <span className="text-[10px] text-muted shrink-0">
                          {round.interviewType === 'technical' ? 'Technical' : 'Intro / culture'}
                        </span>
                        <ChevronDown className={cn('shrink-0 transition-transform', isOpen && 'rotate-180')} size={18} />
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-0 space-y-4 border-t border-border/60 bg-white/40">
                          <div className="flex gap-2 pt-3">
                            <button
                              type="button"
                              onClick={() => moveRound(idx, -1)}
                              disabled={idx === 0}
                              className="p-2 rounded-xl border border-border text-muted hover:text-ink disabled:opacity-30"
                              aria-label="Move up"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveRound(idx, 1)}
                              disabled={idx === interviewSteps.length - 1}
                              className="p-2 rounded-xl border border-border text-muted hover:text-ink disabled:opacity-30"
                              aria-label="Move down"
                            >
                              <ChevronDown size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRound(round.id)}
                              disabled={interviewSteps.length <= 1}
                              className="ml-auto p-2 rounded-xl text-red-400 hover:bg-red-50 disabled:opacity-30"
                              aria-label="Remove round"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 px-1">Round title</label>
                              <input
                                type="text"
                                value={round.title}
                                onChange={(e) => updateRound(round.id, { title: e.target.value })}
                                className="w-full bg-white border border-border rounded-xl p-3 text-sm outline-none"
                                placeholder="e.g. Introductory technical interview"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 px-1">Purpose</label>
                              <textarea
                                value={round.purpose}
                                onChange={(e) => updateRound(round.id, { purpose: e.target.value })}
                                className="w-full bg-white border border-border rounded-xl p-3 text-sm outline-none h-16 resize-none"
                                placeholder="What this round evaluates (shown to the AI)."
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 px-1">Type</label>
                                <select
                                  value={round.interviewType}
                                  onChange={(e) =>
                                    updateRound(round.id, {
                                      interviewType: e.target.value as 'intro' | 'technical',
                                    })
                                  }
                                  className="w-full bg-white border border-border rounded-xl p-3 text-sm outline-none appearance-none"
                                >
                                  <option value="intro">Intro / culture</option>
                                  <option value="technical">Technical</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 px-1">Duration (min)</label>
                                <input
                                  type="number"
                                  min={5}
                                  max={120}
                                  value={round.durationMinutes}
                                  onChange={(e) =>
                                    updateRound(round.id, { durationMinutes: parseInt(e.target.value, 10) || 15 })
                                  }
                                  className="w-full bg-white border border-border rounded-xl p-3 text-sm outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 px-1">
                                System prompt (objectives)
                              </label>
                              <textarea
                                value={round.systemPrompt}
                                onChange={(e) => updateRound(round.id, { systemPrompt: e.target.value })}
                                className="w-full bg-white border border-border rounded-xl p-3 text-sm outline-none h-24 resize-none"
                                placeholder="Instructions for the AI interviewer this round…"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 px-1">
                                Intro prompt
                              </label>
                              <textarea
                                value={round.introPrompt}
                                onChange={(e) => updateRound(round.id, { introPrompt: e.target.value })}
                                className="w-full bg-white border border-border rounded-xl p-3 text-sm outline-none h-20 resize-none"
                                placeholder="How the AI opens this round (greeting, name confirmation, expectations)…"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 px-1">
                                Outro prompt
                              </label>
                              <textarea
                                value={round.outroPrompt}
                                onChange={(e) => updateRound(round.id, { outroPrompt: e.target.value })}
                                className="w-full bg-white border border-border rounded-xl p-3 text-sm outline-none h-20 resize-none"
                                placeholder="How the AI wraps up (feedback, questions, farewell)…"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 px-1">Questions</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {round.questions.map((q, qi) => (
                                <div key={q.id} className="bg-white p-3 rounded-xl border border-border group relative">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Q{qi + 1}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeQuestion(round.id, q.id)}
                                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  <textarea
                                    value={q.text}
                                    onChange={(e) => updateQuestion(round.id, q.id, { text: e.target.value })}
                                    className="w-full bg-transparent text-sm font-medium outline-none resize-none"
                                    rows={2}
                                    placeholder="Question text…"
                                  />
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => addQuestion(round.id)}
                                className="w-full py-2 border border-dashed border-border rounded-xl text-muted hover:text-primary hover:border-primary/40 text-xs font-bold transition-all"
                              >
                                + Add question
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2 px-1">
                              Checklist — items the AI must cover
                            </label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {round.checklist.map((c) => (
                                <div key={c.id} className="bg-white p-3 rounded-xl border border-border group relative flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => updateChecklistItem(round.id, c.id, { required: !c.required })}
                                    className={cn(
                                      'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                                      c.required ? 'border-primary bg-primary text-white' : 'border-border text-transparent hover:border-primary/40',
                                    )}
                                    title={c.required ? 'Required — click to make optional' : 'Optional — click to make required'}
                                  >
                                    {c.required && <Check size={12} />}
                                  </button>
                                  <input
                                    type="text"
                                    value={c.label}
                                    onChange={(e) => updateChecklistItem(round.id, c.id, { label: e.target.value })}
                                    className="flex-1 bg-transparent text-sm font-medium outline-none"
                                    placeholder="e.g. When can you start?"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeChecklistItem(round.id, c.id)}
                                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => addChecklistItem(round.id)}
                                className="w-full py-2 border border-dashed border-border rounded-xl text-muted hover:text-primary hover:border-primary/40 text-xs font-bold transition-all"
                              >
                                + Add checklist item
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-10 pt-8 border-t border-border">
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="flex-1 py-4 font-bold text-sm text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                'flex-1 py-4 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary-hover transition-all shadow-lg shadow-primary/20',
                saving && 'opacity-60',
              )}
            >
              {saving ? 'Saving…' : 'Launch position'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
