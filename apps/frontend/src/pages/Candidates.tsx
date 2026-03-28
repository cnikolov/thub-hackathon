import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { CANDIDATES_SEARCH_DEBOUNCE_MS } from '../lib/candidates-search';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Briefcase,
  ChevronRight,
  ExternalLink,
  FileText,
  GraduationCap,
  MapPin,
  Phone,
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

export function Candidates() {
  const { selectedProjectId } = useOutletContext() as AppOutletContext;
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [debouncedSkills, setDebouncedSkills] = useState('');
  const [interviewedOnly, setInterviewedOnly] = useState(false);
  const [semanticSearch, setSemanticSearch] = useState(false);
  const [semanticRanked, setSemanticRanked] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

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

  async function onCvSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setCvUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.postForm<ApiResult<Candidate>>(`/candidates/${selected.id}/cv`, form);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSelected(res.data);
      setCandidates((prev) => prev.map((c) => (c.id === res.data.id ? res.data : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CV upload failed');
    } finally {
      setCvUploading(false);
      e.target.value = '';
    }
  }

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
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-ink">Candidates</h2>
          <p className="text-muted text-sm mt-1">
            Keyword search across profile and content; enable semantic mode to rank by CV + interview note embeddings
            (requires GEMINI_API_KEY). Upload a PDF/text CV to extract tags and vectorize.
          </p>
        </div>
        <p className="text-sm text-muted tabular-nums shrink-0">
          {candidates.length === 1 ? '1 candidate' : `${candidates.length} candidates`}
        </p>
      </div>

      <div className="bg-card rounded-[24px] border border-border card-shadow p-4 sm:p-5 space-y-4">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            size={18}
            aria-hidden
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, notes, interview content, resume…"
            className="w-full rounded-2xl border border-border bg-surface pl-11 pr-10 py-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-shadow"
            autoComplete="off"
            spellCheck={false}
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/60 transition-colors"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          ) : null}
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

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-semibold text-primary hover:text-primary-hover underline-offset-2 hover:underline"
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-card rounded-[32px] card-shadow border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest">Candidate</th>
                  {semanticRanked ? (
                    <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest">Match</th>
                  ) : null}
                  <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest">AI Score</th>
                  <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest">Date</th>
                  <th className="p-6 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={semanticRanked ? 5 : 4} className="p-12 text-center text-muted text-sm">
                      {hasActiveFilters ? (
                        <span>
                          No candidates match these filters.{' '}
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="font-semibold text-primary hover:underline"
                          >
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
                        className={cn(
                          'hover:bg-surface/50 transition-all cursor-pointer group',
                          selected?.id === c.id && 'bg-primary/5',
                        )}
                      >
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {c.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-ink">{c.name}</p>
                              <p className="text-xs text-muted">{c.email}</p>
                            </div>
                          </div>
                        </td>
                        {semanticRanked ? (
                          <td className="p-6 text-xs font-bold tabular-nums text-primary">
                            {c.matchScore != null ? `${Math.round(c.matchScore * 100)}%` : '—'}
                          </td>
                        ) : null}
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
                            <span className="text-xs font-bold text-ink">{score}%</span>
                          </div>
                        </td>
                        <td className="p-6 text-xs text-muted">{formatDate(c.createdAt)}</td>
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

        <div className="bg-card rounded-[32px] card-shadow border border-border p-8 lg:sticky lg:top-8 h-fit">
          {selected ? (
            <div className="space-y-8">
              <div className="pb-6 border-b border-border space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-[24px] bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
                    {selected.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold tracking-tight text-ink truncate">{selected.name}</h3>
                    {selected.headline ? (
                      <p className="text-xs text-ink/70 font-medium truncate">{selected.headline}</p>
                    ) : null}
                    <p className="text-xs text-muted font-medium truncate">{selected.email}</p>
                    <p className="text-[10px] text-muted mt-0.5">Job #{selected.jobId}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
                  {selected.phone ? (
                    <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Phone size={13} />
                      {selected.phone}
                    </a>
                  ) : null}
                  {selected.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={13} />
                      {selected.location}
                    </span>
                  ) : null}
                </div>

                {(selected.socialLinks?.length ?? 0) > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(selected.socialLinks ?? []).map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface text-[11px] font-semibold text-ink hover:border-primary/40 hover:text-primary transition-colors"
                      >
                        {link.platform}
                        <ExternalLink size={11} className="opacity-50" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">CV / resume</h4>
                  <input
                    ref={cvInputRef}
                    type="file"
                    accept=".pdf,.txt,text/plain,application/pdf"
                    className="sr-only"
                    onChange={onCvSelected}
                  />
                  <button
                    type="button"
                    disabled={cvUploading}
                    onClick={() => cvInputRef.current?.click()}
                    className="w-full py-3 rounded-2xl border border-border bg-surface text-sm font-semibold text-ink hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <Upload size={18} />
                    {cvUploading ? 'Processing…' : selected.resumeText ? 'Replace CV (PDF or text)' : 'Upload CV (PDF or text)'}
                  </button>
                  <p className="text-[11px] text-muted mt-2">
                    Extracts text, generates skill tags and availability, and stores a vector for semantic search.
                  </p>
                </div>

                {selected.availability ? (
                  <div>
                    <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Availability</h4>
                    <p className="text-sm text-ink font-medium">{selected.availability}</p>
                  </div>
                ) : null}

                {(selected.skillsTags?.length ?? 0) > 0 ? (
                  <div>
                    <h4 className="text-[10px] font-bold text-violet-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                      CV skill tags
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(selected.skillsTags ?? []).map((s, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-violet-50 text-violet-800 rounded-xl text-[10px] font-bold border border-violet-100"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selected.experienceSummary ? (
                  <div>
                    <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Briefcase size={13} className="text-muted/60" />
                      Experience
                    </h4>
                    <p className="text-xs text-ink leading-relaxed">{selected.experienceSummary}</p>
                  </div>
                ) : null}

                {selected.educationSummary ? (
                  <div>
                    <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                      <GraduationCap size={13} className="text-muted/60" />
                      Education
                    </h4>
                    <p className="text-xs text-ink leading-relaxed">{selected.educationSummary}</p>
                  </div>
                ) : null}

                {selected.resumeText ? (
                  <details className="group">
                    <summary className="text-[10px] font-bold text-muted uppercase tracking-widest cursor-pointer select-none hover:text-primary transition-colors">
                      Raw resume text
                    </summary>
                    <div className="mt-2 bg-surface p-4 rounded-2xl border border-border max-h-40 overflow-y-auto">
                      <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">{selected.resumeText}</p>
                    </div>
                  </details>
                ) : null}

                <div>
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">AI analysis summary</h4>
                  <div className="bg-surface p-4 rounded-2xl border border-border">
                    <p className="text-sm text-ink leading-relaxed italic">
                      &quot;{selected.notes ?? 'No notes yet.'}&quot;
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <h4 className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Key strengths
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(selected.strengths ?? []).map((s, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-green-50 text-green-700 rounded-xl text-[10px] font-bold border border-green-100"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      Areas for growth
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(selected.weaknesses ?? []).map((w, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-xl text-[10px] font-bold border border-orange-100"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTranscriptOpen((o) => !o)}
                className="w-full py-4 bg-ink text-white rounded-2xl font-bold text-sm hover:bg-ink/90 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <FileText size={18} />
                {transcriptOpen ? 'Hide transcript' : 'View full transcript'}
              </button>
              {transcriptOpen && selected.transcript && (
                <pre className="text-xs bg-surface p-4 rounded-2xl border border-border whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {selected.transcript}
                </pre>
              )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center text-muted/30">
                <Users size={32} />
              </div>
              <p className="text-muted text-sm font-medium">Select a candidate to view detailed AI analysis</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
