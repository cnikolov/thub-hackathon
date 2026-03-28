import { Mail, Star } from 'lucide-react';
import type { Candidate } from '../../lib/types';
import { cn } from '../../lib/utils';

const statusStyles: Record<Candidate['status'], string> = {
  pending: 'bg-amber-50 text-amber-800',
  interviewed: 'bg-blue-50 text-blue-800',
  shortlisted: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800',
};

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <article className="rounded-3xl border border-border bg-card p-6 card-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-lg text-ink truncate">{candidate.name}</h3>
          <p className="text-sm text-muted inline-flex items-center gap-2 mt-1 truncate">
            <Mail size={14} className="shrink-0" />
            {candidate.email}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg',
            statusStyles[candidate.status],
          )}
        >
          {candidate.status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        {candidate.score != null && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
            <Star size={16} className="text-amber-500" />
            {candidate.score}
          </span>
        )}
        <span className="text-muted text-xs">Job #{candidate.jobId}</span>
      </div>

      {candidate.notes && (
        <p className="mt-4 text-sm text-muted border-t border-border pt-4 line-clamp-3">{candidate.notes}</p>
      )}
    </article>
  );
}
