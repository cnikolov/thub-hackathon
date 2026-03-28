import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Users,
} from 'lucide-react';
import type { Job } from '../../lib/types';
import { cn } from '../../lib/utils';

function sortedSteps(job: Job) {
  const s = job.interviewSteps ?? [];
  return [...s].sort((a, b) => a.stepOrder - b.stepOrder);
}

export function JobCard({ job }: { job: Job }) {
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const steps = sortedSteps(job);
  const roundCount = steps.length || 1;

  function copyCode() {
    void navigator.clipboard.writeText(job.shareCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  return (
    <div className="bg-card rounded-3xl card-shadow border border-border overflow-hidden transition-all hover:border-primary/30">
      <div className="p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6">
          <div className="flex gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Briefcase size={24} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold tracking-tight text-ink truncate">{job.title}</h3>
              <div className="flex flex-wrap items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Clock size={14} />
                  {job.durationMinutes ?? 15} min · {roundCount} interview round{roundCount === 1 ? '' : 's'}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Users size={14} />
                  {job.interviewType === 'technical' ? 'Technical' : 'Culture'} (primary)
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {job.status.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-surface border border-border rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Share Code</span>
              <span className="font-mono font-bold text-primary">{job.shareCode}</span>
              <button type="button" onClick={copyCode} className="text-muted hover:text-primary transition-colors" aria-label="Copy share code">
                {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-muted hover:text-ink transition-colors"
              aria-expanded={isExpanded}
            >
              <ChevronDown className={cn('transition-transform duration-300', isExpanded && 'rotate-180')} size={20} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-6 border-t border-border mt-6 grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div>
                  <h4 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Job Description</h4>
                  <div className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{job.description}</div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Interview pipeline</h4>
                  <ol className="space-y-4 list-decimal list-inside text-sm">
                    {steps.map((st, i) => (
                      <li key={st.id ?? `legacy-${i}`} className="text-ink">
                        <span className="font-semibold">{st.title}</span>
                        <span className="text-muted font-normal"> — {st.purpose}</span>
                        <div className="mt-1 ml-6 text-xs text-muted pl-0 list-none">
                          {(st.questions ?? []).length > 0 ? (
                            <ul className="space-y-1 list-disc list-inside">
                              {(st.questions ?? []).map((q) => (
                                <li key={q.id}>{q.text}</li>
                              ))}
                            </ul>
                          ) : (
                            <span>No scripted questions for this round.</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
