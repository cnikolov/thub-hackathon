import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ListChecks,
  MessageSquareText,
  PartyPopper,
  Plus,
  Save,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { api, type ApiResult } from '../../lib/api';
import type { Job, JobInterviewStep, Question } from '../../lib/types';
import { cn } from '../../lib/utils';

type Phase = 'intro' | 'objectives' | 'outro';

type ChecklistDraft = { id: string; label: string; required: boolean };

type RoundDraft = {
  id: string;
  dbId: number | null;
  title: string;
  purpose: string;
  interviewType: 'intro' | 'technical';
  durationMinutes: number;
  systemPrompt: string;
  introPrompt: string;
  outroPrompt: string;
  questions: Question[];
  checklist: ChecklistDraft[];
};

function toRoundDraft(step: JobInterviewStep): RoundDraft {
  return {
    id: `step-${step.id ?? Math.random().toString(36).slice(2)}`,
    dbId: step.id,
    title: step.title,
    purpose: step.purpose,
    interviewType: step.interviewType,
    durationMinutes: step.durationMinutes ?? 15,
    systemPrompt: step.systemPrompt,
    introPrompt: step.introPrompt ?? '',
    outroPrompt: step.outroPrompt ?? '',
    questions: (step.questions ?? []).map((q) => ({ ...q, possibleAnswers: q.possibleAnswers ?? [] })),
    checklist: (step.checklist ?? []).map((c) => ({ ...c })),
  };
}

function newRound(n: number): RoundDraft {
  return {
    id: `new-${Math.random().toString(36).slice(2, 11)}`,
    dbId: null,
    title: `Round ${n}`,
    purpose: '',
    interviewType: 'intro',
    durationMinutes: 15,
    systemPrompt: '',
    introPrompt: '1. Greet the candidate warmly.\n2. Confirm their name.\n3. Set expectations for this round.\n4. Ask if they have any quick questions.',
    outroPrompt: '1. Signal wrap-up.\n2. Give brief positive feedback.\n3. Ask if they have questions.\n4. Thank them warmly.',
    questions: [],
    checklist: [
      { id: `cl-${Math.random().toString(36).slice(2, 9)}`, label: 'When can you start?', required: true },
      { id: `cl-${Math.random().toString(36).slice(2, 9)}`, label: 'What are your salary expectations?', required: true },
    ],
  };
}

const PHASES: { key: Phase; label: string; icon: typeof MessageSquareText; color: string; bg: string; border: string }[] = [
  { key: 'intro', label: 'Intro', icon: MessageSquareText, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'objectives', label: 'Objectives', icon: Target, color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/20' },
  { key: 'outro', label: 'Outro', icon: PartyPopper, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
];

export function JobEditModal({
  job,
  onClose,
  onSaved,
}: {
  job: Job;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const steps = [...(job.interviewSteps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder);
  const [rounds, setRounds] = useState<RoundDraft[]>(() =>
    steps.length > 0 ? steps.map(toRoundDraft) : [newRound(1)],
  );
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activePhase, setActivePhase] = useState<Phase>('intro');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const round = rounds[selectedIdx]!;

  function updateRound(updates: Partial<RoundDraft>) {
    setRounds((prev) => prev.map((r, i) => (i === selectedIdx ? { ...r, ...updates } : r)));
  }

  function addRound() {
    const n = rounds.length + 1;
    setRounds((prev) => [...prev, newRound(n)]);
    setSelectedIdx(rounds.length);
    setActivePhase('intro');
  }

  function removeRound(idx: number) {
    if (rounds.length <= 1) return;
    setRounds((prev) => prev.filter((_, i) => i !== idx));
    if (selectedIdx >= rounds.length - 1) setSelectedIdx(Math.max(0, rounds.length - 2));
  }

  function moveRound(idx: number, dir: -1 | 1) {
    setRounds((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });
    setSelectedIdx(idx + dir);
  }

  function addQuestion() {
    updateRound({
      questions: [...round.questions, { id: Math.random().toString(36).slice(2, 9), text: '', isMandatory: true, possibleAnswers: [] }],
    });
  }

  function removeQuestion(qid: string) {
    updateRound({ questions: round.questions.filter((q) => q.id !== qid) });
  }

  function updateQuestion(qid: string, updates: Partial<Question>) {
    updateRound({ questions: round.questions.map((q) => (q.id === qid ? { ...q, ...updates } : q)) });
  }

  function addChecklistItem() {
    updateRound({
      checklist: [...round.checklist, { id: `cl-${Math.random().toString(36).slice(2, 9)}`, label: '', required: true }],
    });
  }

  function removeChecklistItem(cid: string) {
    updateRound({ checklist: round.checklist.filter((c) => c.id !== cid) });
  }

  function updateChecklistItem(cid: string, updates: Partial<ChecklistDraft>) {
    updateRound({ checklist: round.checklist.map((c) => (c.id === cid ? { ...c, ...updates } : c)) });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        interviewSteps: rounds.map((r, i) => ({
          title: r.title.trim() || `Round ${i + 1}`,
          purpose: r.purpose.trim() || r.title.trim() || `Interview round ${i + 1}`,
          interviewType: r.interviewType,
          durationMinutes: r.durationMinutes,
          systemPrompt: r.systemPrompt.trim() || 'You are a professional AI interviewer.',
          introPrompt: r.introPrompt.trim() || null,
          outroPrompt: r.outroPrompt.trim() || null,
          questions: r.questions.filter((q) => q.text.trim()),
          checklist: r.checklist.filter((c) => c.label.trim()),
        })),
      };
      const res = await api.patch<ApiResult<Job>>(`/jobs/${job.id}`, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onClose();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const phaseInfo = PHASES.find((p) => p.key === activePhase)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-ink/25 backdrop-blur-md" aria-label="Close" onClick={() => !saving && onClose()} />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-card rounded-[28px] w-full max-w-6xl shadow-2xl border border-border relative z-10 max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">{job.title}</h2>
              <p className="text-sm text-muted mt-1">Configure interview rounds — each has an intro, objectives, and outro phase.</p>
            </div>
            <button type="button" onClick={() => !saving && onClose()} className="p-2 rounded-xl hover:bg-surface text-muted hover:text-ink transition-colors">
              <X size={20} />
            </button>
          </div>
          {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex flex-1 min-h-0">
          {/* Left: Round selector */}
          <div className="w-56 border-r border-border bg-surface/50 shrink-0 flex flex-col">
            <div className="px-4 pt-5 pb-3">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Rounds</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              {rounds.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setSelectedIdx(idx); setActivePhase('intro'); }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all group',
                    idx === selectedIdx
                      ? 'bg-white shadow-sm border border-border font-semibold text-ink'
                      : 'text-muted hover:bg-white/60 hover:text-ink',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0',
                      idx === selectedIdx ? 'bg-primary text-white' : 'bg-border/60 text-muted',
                    )}>
                      {idx + 1}
                    </span>
                    <span className="truncate">{r.title.trim() || `Round ${idx + 1}`}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 ml-7">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span className="text-[9px] text-muted ml-1">
                      {r.interviewType === 'technical' ? 'Technical' : 'Culture'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-border/60 space-y-2">
              <button type="button" onClick={addRound} className="w-full py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-xl transition-colors flex items-center justify-center gap-1">
                <Plus size={14} /> Add round
              </button>
              {rounds.length > 1 && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveRound(selectedIdx, -1)} disabled={selectedIdx === 0} className="flex-1 py-1.5 text-muted hover:text-ink disabled:opacity-20 rounded-lg hover:bg-white transition-colors flex items-center justify-center">
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" onClick={() => moveRound(selectedIdx, 1)} disabled={selectedIdx === rounds.length - 1} className="flex-1 py-1.5 text-muted hover:text-ink disabled:opacity-20 rounded-lg hover:bg-white transition-colors flex items-center justify-center">
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" onClick={() => removeRound(selectedIdx)} className="flex-1 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Round editor */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Round header fields */}
            <div className="px-6 pt-5 pb-4 border-b border-border/60 bg-white/40">
              <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Title</label>
                  <input
                    type="text"
                    value={round.title}
                    onChange={(e) => updateRound({ title: e.target.value })}
                    className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. Technical screen"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Purpose</label>
                  <input
                    type="text"
                    value={round.purpose}
                    onChange={(e) => updateRound({ purpose: e.target.value })}
                    className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="What this round evaluates"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Type</label>
                  <select
                    value={round.interviewType}
                    onChange={(e) => updateRound({ interviewType: e.target.value as 'intro' | 'technical' })}
                    className="bg-white border border-border rounded-xl px-3 py-2 text-sm outline-none appearance-none min-w-[120px]"
                  >
                    <option value="intro">Culture</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Min</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={round.durationMinutes}
                    onChange={(e) => updateRound({ durationMinutes: parseInt(e.target.value, 10) || 15 })}
                    className="w-16 bg-white border border-border rounded-xl px-3 py-2 text-sm outline-none text-center"
                  />
                </div>
              </div>
            </div>

            {/* Phase tabs */}
            <div className="px-6 pt-3 pb-0 flex gap-1 shrink-0">
              {PHASES.map((p) => {
                const Icon = p.icon;
                const active = activePhase === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setActivePhase(p.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all border border-b-0',
                      active
                        ? `${p.bg} ${p.color} ${p.border}`
                        : 'text-muted hover:text-ink border-transparent hover:bg-surface',
                    )}
                  >
                    <Icon size={15} />
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Phase content */}
            <div className={cn('flex-1 overflow-y-auto border-t', phaseInfo.border)}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${round.id}-${activePhase}`}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                  className="p-6"
                >
                  {activePhase === 'intro' && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <MessageSquareText size={16} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-ink">Introduction</p>
                            <p className="text-[11px] text-muted">How the AI opens this round — greeting, name confirmation, setting expectations.</p>
                          </div>
                        </div>
                        <textarea
                          value={round.introPrompt}
                          onChange={(e) => updateRound({ introPrompt: e.target.value })}
                          className="w-full bg-white border border-emerald-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-emerald-200 h-48 resize-none leading-relaxed"
                          placeholder="Write step-by-step instructions for how the AI should introduce the interview round…"
                        />
                      </div>
                    </div>
                  )}

                  {activePhase === 'objectives' && (
                    <div className="space-y-6">
                      {/* System prompt */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Target size={16} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-ink">AI Persona & Instructions</p>
                            <p className="text-[11px] text-muted">The core personality and behavior for this round.</p>
                          </div>
                        </div>
                        <textarea
                          value={round.systemPrompt}
                          onChange={(e) => updateRound({ systemPrompt: e.target.value })}
                          className="w-full bg-white border border-primary/20 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 h-28 resize-none leading-relaxed"
                          placeholder="e.g. You are a senior technical interviewer. Be rigorous but fair…"
                        />
                      </div>

                      {/* Questions */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                              <MessageSquareText size={16} className="text-blue-500" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-ink">Questions</p>
                              <p className="text-[11px] text-muted">Mandatory questions the AI must ask.</p>
                            </div>
                          </div>
                          <button type="button" onClick={addQuestion} className="text-xs font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            <Plus size={12} /> Add
                          </button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {round.questions.length === 0 && (
                            <p className="text-xs text-muted italic px-1">No questions yet — the AI will lead naturally based on the role.</p>
                          )}
                          {round.questions.map((q, qi) => (
                            <div key={q.id} className="flex items-start gap-2 group">
                              <span className="text-[10px] font-bold text-primary mt-3 shrink-0 w-5 text-right">Q{qi + 1}</span>
                              <textarea
                                value={q.text}
                                onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                                className="flex-1 bg-white border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none"
                                rows={2}
                                placeholder="Question text…"
                              />
                              <button type="button" onClick={() => removeQuestion(q.id)} className="mt-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Checklist */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                              <ListChecks size={16} className="text-violet-500" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-ink">Checklist</p>
                              <p className="text-[11px] text-muted">Items the AI must cover during the conversation.</p>
                            </div>
                          </div>
                          <button type="button" onClick={addChecklistItem} className="text-xs font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            <Plus size={12} /> Add
                          </button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {round.checklist.length === 0 && (
                            <p className="text-xs text-muted italic px-1">No checklist items — add topics the AI should confirm.</p>
                          )}
                          {round.checklist.map((c) => (
                            <div key={c.id} className="flex items-center gap-2.5 group">
                              <button
                                type="button"
                                onClick={() => updateChecklistItem(c.id, { required: !c.required })}
                                className={cn(
                                  'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                                  c.required ? 'border-primary bg-primary text-white' : 'border-border hover:border-primary/30',
                                )}
                                title={c.required ? 'Required — click to make optional' : 'Optional — click to make required'}
                              >
                                {c.required && <Check size={11} />}
                              </button>
                              <input
                                type="text"
                                value={c.label}
                                onChange={(e) => updateChecklistItem(c.id, { label: e.target.value })}
                                className="flex-1 bg-white border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                placeholder="e.g. When can you start?"
                              />
                              <button type="button" onClick={() => removeChecklistItem(c.id)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activePhase === 'outro' && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                            <PartyPopper size={16} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-ink">Wrap-up</p>
                            <p className="text-[11px] text-muted">How the AI closes this round — feedback, candidate questions, farewell.</p>
                          </div>
                        </div>
                        <textarea
                          value={round.outroPrompt}
                          onChange={(e) => updateRound({ outroPrompt: e.target.value })}
                          className="w-full bg-white border border-amber-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-200 h-48 resize-none leading-relaxed"
                          placeholder="Write step-by-step instructions for how the AI should wrap up the round…"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0 bg-white/60">
              <p className="text-[11px] text-muted">
                {rounds.length} round{rounds.length === 1 ? '' : 's'} configured
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => !saving && onClose()}
                  className="px-5 py-2.5 font-bold text-sm text-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    'px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center gap-2',
                    saving && 'opacity-60',
                  )}
                >
                  <Save size={16} />
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
