import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { CANDIDATES_SEARCH_DEBOUNCE_MS } from '../lib/candidates-search';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase,
  ChevronRight,
  ExternalLink,
  FileText,
  GraduationCap,
  MapPin,
  MessageSquarePlus,
  Phone,
  Save,
  Search,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { api, type ApiResult } from '../lib/api';
import type { AppOutletContext } from '../lib/outlet-context';
import type { Candidate } from '../lib/types';
import { cn } from '../lib/utils';

function formatDate(createdAt: Date | string | null) {
  if (createdAt == null) return '—';
  const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusColor(status: Candidate['status']) {
  switch (status) {
    case 'shortlisted': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'interviewed': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'rejected':    return 'bg-red-50 text-red-700 border-red-200';
    default:            return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

/* ─── Modal ───────────────────────────────────────────────────────────── */

function CandidateModal({
  candidate,
  onClose,
  onUpdated,
}: {
  candidate: Candidate;
  onClose: () => void;
  onUpdated: (c: Candidate) => void;
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const [adminNotes, setAdminNotes] = useState(candidate.notes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    setAdminNotes(candidate.notes ?? '');
    setNotesDirty(false);
  }, [candidate.id, candidate.notes]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function saveNotes() {
    setNotesSaving(true);
    setError(null);
    try {
      const res = await api.patch<ApiResult<Candidate>>(`/candidates/${candidate.id}`, {
        notes: adminNotes,
      });
      if ('success' in res && !res.success) {
        setError(res.error);
        return;
      }
      const updated = 'data' in res ? res.data : (res as unknown as Candidate);
      onUpdated(updated);
      setNotesDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  }

  async function onCvSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.postForm<ApiResult<Candidate>>(`/candidates/${candidate.id}/cv`, form);
      if (!res.success) { setError(res.error); return; }
      onUpdated(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CV upload failed');
    } finally {
      setCvUploading(false);
      e.target.value = '';
    }
  }

  const score = candidate.score ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 backdrop-blur-sm p-4 sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-3xl bg-card rounded-[28px] border border-border card-shadow my-4"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 p-2 rounded-xl text-muted hover:text-ink hover:bg-surface transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="p-6 sm:p-8 space-y-7 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</div>
          )}

          {/* Header */}
          <div className="flex items-start gap-5 pr-10">
            <div className="w-16 h-16 rounded-[22px] bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {candidate.name.charAt(0)}
            </div>
            <div className="min-w-0 space-y-1.5">
              <h3 className="text-2xl font-bold tracking-tight text-ink truncate">{candidate.name}</h3>
              {candidate.headline && (
                <p className="text-sm text-ink/70 font-medium truncate">{candidate.headline}</p>
              )}
              <p className="text-sm text-muted font-medium truncate">{candidate.email}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className={cn('px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wide border', statusColor(candidate.status))}>
                  {candidate.status}
                </span>
                <span className="text-xs text-muted">Job #{candidate.jobId}</span>
                <span className="text-xs text-muted">{formatDate(candidate.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Contact & socials */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {candidate.phone && (
              <a href={`tel:${candidate.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                <Phone size={14} /> {candidate.phone}
              </a>
            )}
            {candidate.location && (
              <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {candidate.location}</span>
            )}
          </div>
          {(candidate.socialLinks?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {(candidate.socialLinks ?? []).map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface text-[11px] font-semibold text-ink hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {link.platform} <ExternalLink size={11} className="opacity-50" />
                </a>
              ))}
            </div>
          )}

          {/* Score bar */}
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest shrink-0">AI Score</span>
            <div className="flex-1 h-2.5 bg-surface rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                className={cn(
                  'h-full rounded-full',
                  score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-primary' : 'bg-orange-500',
                )}
              />
            </div>
            <span className="text-sm font-bold text-ink tabular-nums w-12 text-right">{score}%</span>
          </div>

          {/* Two-column detail grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-6">
              {/* CV upload */}
              <div>
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">CV / Resume</h4>
                <input ref={cvInputRef} type="file" accept=".pdf,.txt,text/plain,application/pdf" className="sr-only" onChange={onCvSelected} />
                <button
                  type="button"
                  disabled={cvUploading}
                  onClick={() => cvInputRef.current?.click()}
                  className="w-full py-2.5 rounded-2xl border border-border bg-surface text-sm font-semibold text-ink hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Upload size={16} />
                  {cvUploading ? 'Processing…' : candidate.resumeText ? 'Replace CV' : 'Upload CV'}
                </button>
              </div>

              {candidate.availability && (
                <div>
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Availability</h4>
                  <p className="text-sm text-ink font-medium">{candidate.availability}</p>
                </div>
              )}

              {(candidate.skillsTags?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-violet-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> CV skill tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(candidate.skillsTags ?? []).map((s, i) => (
                      <span key={i} className="px-2.5 py-1 bg-violet-50 text-violet-800 rounded-xl text-[10px] font-bold border border-violet-100">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {candidate.experienceSummary && (
                <div>
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <Briefcase size={13} className="text-muted/60" /> Experience
                  </h4>
                  <p className="text-xs text-ink leading-relaxed">{candidate.experienceSummary}</p>
                </div>
              )}

              {candidate.educationSummary && (
                <div>
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <GraduationCap size={13} className="text-muted/60" /> Education
                  </h4>
                  <p className="text-xs text-ink leading-relaxed">{candidate.educationSummary}</p>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Strengths */}
              <div>
                <h4 className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Key strengths
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(candidate.strengths ?? []).map((s, i) => (
                    <span key={i} className="px-2.5 py-1 bg-green-50 text-green-700 rounded-xl text-[10px] font-bold border border-green-100">{s}</span>
                  ))}
                </div>
              </div>

              {/* Weaknesses */}
              <div>
                <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Areas for growth
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(candidate.weaknesses ?? []).map((w, i) => (
                    <span key={i} className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-xl text-[10px] font-bold border border-orange-100">{w}</span>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* AI analysis – full width */}
          <div>
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">AI analysis summary</h4>
            <div className="bg-surface p-3.5 rounded-2xl border border-border">
              <p className="text-sm text-ink leading-relaxed italic">
                &quot;{candidate.notes ?? 'No AI notes yet.'}&quot;
              </p>
            </div>
          </div>

          {/* Admin notes (editable) */}
          <div className="border-t border-border pt-6">
            <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
              <MessageSquarePlus size={14} /> Admin notes
            </h4>
            <textarea
              value={adminNotes}
              onChange={(e) => { setAdminNotes(e.target.value); setNotesDirty(true); }}
              placeholder="Add your own notes about this candidate…"
              rows={4}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 resize-y transition-shadow"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-[11px] text-muted">
                {notesDirty ? 'Unsaved changes' : 'Saved'}
              </p>
              <button
                type="button"
                disabled={!notesDirty || notesSaving}
                onClick={saveNotes}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all',
                  notesDirty
                    ? 'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20'
                    : 'bg-surface text-muted border border-border cursor-not-allowed',
                )}
              >
                <Save size={15} />
                {notesSaving ? 'Saving…' : 'Save notes'}
              </button>
            </div>
          </div>

          {/* Resume text */}
          {candidate.resumeText && (
            <details className="group">
              <summary className="text-[10px] font-bold text-muted uppercase tracking-widest cursor-pointer select-none hover:text-primary transition-colors">
                Raw resume text
              </summary>
              <div className="mt-2 bg-surface p-4 rounded-2xl border border-border max-h-40 overflow-y-auto">
                <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">{candidate.resumeText}</p>
              </div>
            </details>
          )}

          {/* Transcript */}
          <button
            type="button"
            onClick={() => setTranscriptOpen((o) => !o)}
            className="w-full py-3.5 bg-ink text-white rounded-2xl font-bold text-sm hover:bg-ink/90 transition-all shadow-xl flex items-center justify-center gap-2"
          >
            <FileText size={18} />
            {transcriptOpen ? 'Hide transcript' : 'View full transcript'}
          </button>
          {transcriptOpen && candidate.transcript && (
            <pre className="text-xs bg-surface p-4 rounded-2xl border border-border whitespace-pre-wrap max-h-64 overflow-y-auto">
              {candidate.transcript}
            </pre>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────── */

export function Candidates() {
  const { selectedProjectId } = useOutletContext() as AppOutletContext;
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [debouncedSkills, setDebouncedSkills] = useState('');
  const [interviewedOnly, setInterviewedOnly] = useState(false);
  const [semanticSearch, setSemanticSearch] = useState(false);
  const [semanticRanked, setSemanticRanked] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQ(searchInput.trim());
      setDebouncedSkills(skillsInput.trim());
    }, CANDIDATES_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput, skillsInput]);

  useEffect(() => {
    async function load() {
      if (selectedProjectId == null) {
        setCandidates([]);
        setSelected(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('projectId', String(selectedProjectId));
        if (debouncedQ) params.set('q', debouncedQ);
        if (debouncedSkills) params.set('skills', debouncedSkills);
        if (interviewedOnly) params.set('interviewedOnly', 'true');
        if (semanticSearch && debouncedQ) params.set('semantic', 'true');

        const res = await api.get<
          ApiResult<Candidate[]> & { meta?: { semantic?: boolean } }
        >(`/candidates?${params.toString()}`);
        if (!res.success) {
          setError(res.error);
          setSemanticRanked(false);
          return;
        }
        setSemanticRanked(Boolean(res.meta?.semantic));
        setCandidates(res.data);
        setSelected((prev) => {
          if (!prev) return null;
          return res.data.find((c) => c.id === prev.id) ?? null;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load candidates');
        setSemanticRanked(false);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [selectedProjectId, debouncedQ, debouncedSkills, interviewedOnly, semanticSearch]);

  const hasActiveFilters = Boolean(
    debouncedQ || debouncedSkills || interviewedOnly || semanticSearch,
  );

  function clearFilters() {
    setSearchInput('');
    setSkillsInput('');
    setDebouncedQ('');
    setDebouncedSkills('');
    setInterviewedOnly(false);
    setSemanticSearch(false);
    setSemanticRanked(false);
  }

  const handleCandidateUpdated = useCallback((updated: Candidate) => {
    setSelected(updated);
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  if (selectedProjectId == null) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center text-muted">
        Select or create a project to see candidates.
      </div>
    );
  }

  if (loading) {
    return <div className="text-muted text-sm animate-pulse">Loading candidates…</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-ink">Candidates</h2>
          <p className="text-muted text-sm mt-1">
            Keyword search across profile and content; enable semantic mode to rank by CV + interview note embeddings.
          </p>
        </div>
        <p className="text-sm text-muted tabular-nums shrink-0">
          {candidates.length === 1 ? '1 candidate' : `${candidates.length} candidates`}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-[24px] border border-border card-shadow p-4 sm:p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={18} aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, notes, interview content, resume…"
            className="w-full rounded-2xl border border-border bg-surface pl-11 pr-10 py-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-shadow"
            autoComplete="off"
            spellCheck={false}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/60 transition-colors"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted">
          Search requests run {CANDIDATES_SEARCH_DEBOUNCE_MS}ms after you stop typing (per field).
        </p>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
          <div className="flex-1 min-w-0">
            <label htmlFor="candidates-skills" className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">
              Strong skills (comma-separated)
            </label>
            <input
              id="candidates-skills"
              type="text"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="e.g. React, TypeScript, system design"
              className="w-full rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted mt-1.5">
              Matches interview strengths and CV skill tags; all listed terms must appear.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:pb-0.5">
            <label
              className={cn(
                'inline-flex items-center gap-2.5 cursor-pointer select-none rounded-2xl border px-4 py-2.5 text-sm transition-colors',
                semanticSearch && debouncedQ
                  ? 'border-primary/40 bg-primary/5 text-ink'
                  : 'border-border bg-surface text-ink hover:border-primary/30',
              )}
              title="Uses Gemini embeddings on your query vs stored CV and interview-note vectors"
            >
              <input
                type="checkbox"
                checked={semanticSearch}
                onChange={(e) => setSemanticSearch(e.target.checked)}
                disabled={!debouncedQ}
                className="rounded border-border text-primary focus:ring-primary/30 disabled:opacity-40"
              />
              <span className="font-medium">Semantic search</span>
            </label>

            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-ink hover:border-primary/30 transition-colors">
              <input
                type="checkbox"
                checked={interviewedOnly}
                onChange={(e) => setInterviewedOnly(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary/30"
              />
              <span className="font-medium">Interviewed only</span>
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-semibold text-primary hover:text-primary-hover underline-offset-2 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full-width table */}
      <div className="bg-card rounded-[32px] card-shadow border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest">Candidate</th>
                <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                {semanticRanked && (
                  <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest">Match</th>
                )}
                <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest">AI Score</th>
                <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest hidden sm:table-cell">Skills</th>
                <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest">Date</th>
                <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={semanticRanked ? 7 : 6} className="p-12 text-center text-muted text-sm">
                    {hasActiveFilters ? (
                      <span>
                        No candidates match these filters.{' '}
                        <button type="button" onClick={clearFilters} className="font-semibold text-primary hover:underline">
                          Clear filters
                        </button>
                      </span>
                    ) : (
                      <span className="italic">No candidates found yet.</span>
                    )}
                  </td>
                </tr>
              ) : (
                candidates.map((c) => {
                  const score = c.score ?? 0;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="hover:bg-surface/50 transition-all cursor-pointer group"
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {c.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-ink truncate">{c.name}</p>
                            <p className="text-xs text-muted truncate">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border', statusColor(c.status))}>
                          {c.status}
                        </span>
                      </td>
                      {semanticRanked && (
                        <td className="p-6 text-xs font-bold tabular-nums text-primary">
                          {c.matchScore != null ? `${Math.round(c.matchScore * 100)}%` : '—'}
                        </td>
                      )}
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-surface rounded-full w-24 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${score}%` }}
                              className={cn(
                                'h-full rounded-full',
                                score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-primary' : 'bg-orange-500',
                              )}
                            />
                          </div>
                          <span className="text-xs font-bold text-ink tabular-nums">{score}%</span>
                        </div>
                      </td>
                      <td className="p-6 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(c.skillsTags ?? []).slice(0, 3).map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-lg text-[10px] font-semibold border border-violet-100 truncate max-w-[80px]">
                              {s}
                            </span>
                          ))}
                          {(c.skillsTags?.length ?? 0) > 3 && (
                            <span className="text-[10px] text-muted font-medium">+{(c.skillsTags?.length ?? 0) - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-xs text-muted whitespace-nowrap">{formatDate(c.createdAt)}</td>
                      <td className="p-6 text-right">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface text-muted group-hover:text-primary group-hover:bg-primary/10 transition-all">
                          <ChevronRight size={16} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <CandidateModal
            key={selected.id}
            candidate={selected}
            onClose={() => setSelected(null)}
            onUpdated={handleCandidateUpdated}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
