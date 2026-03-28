import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckSquare, Clock, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { api, type ApiResult } from '../lib/api';
import type { AppOutletContext } from '../lib/outlet-context';
import type { InterviewAttendance } from '../lib/types';
import { cn } from '../lib/utils';

function timeAgo(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Attendance() {
  const { selectedProjectId } = useOutletContext() as AppOutletContext;
  const [rows, setRows] = useState<InterviewAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (selectedProjectId == null) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiResult<InterviewAttendance[]>>(
        `/jobs/attendance?projectId=${encodeURIComponent(String(selectedProjectId))}`,
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      setRows(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedProjectId == null) return;
    const interval = setInterval(() => void load(), 15_000);
    return () => clearInterval(interval);
  }, [load, selectedProjectId]);

  const completed = rows.filter((r) => r.completedAt);
  const inProgress = rows.filter((r) => !r.completedAt);

  if (selectedProjectId == null) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-border rounded-3xl bg-card">
        <CheckSquare className="w-12 h-12 opacity-20 mb-4 text-ink" />
        <h3 className="text-xl font-semibold mb-2 text-ink">No project selected</h3>
        <p className="text-sm text-muted max-w-xs">Select a project from the header to view interview attendance.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-ink">Interview attendance</h2>
          <p className="text-muted text-sm mt-2">
            Live tracker — see who has joined an interview and whether they completed it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-5 py-2.5 bg-surface border border-border rounded-xl font-bold text-sm hover:bg-border transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-card rounded-2xl border border-border p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{inProgress.length}</p>
            <p className="text-xs text-muted font-semibold uppercase tracking-widest">In progress</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-500">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{completed.length}</p>
            <p className="text-xs text-muted font-semibold uppercase tracking-widest">Completed</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center text-muted">
            <UserX size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{rows.length}</p>
            <p className="text-xs text-muted font-semibold uppercase tracking-widest">Total sessions</p>
          </div>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="text-muted text-sm animate-pulse">Loading attendance…</div>
      ) : rows.length === 0 ? (
        <div className="bg-card p-12 rounded-[32px] border border-border text-center">
          <p className="text-muted italic">No interview sessions yet for this project.</p>
        </div>
      ) : (
        <div className="bg-card rounded-3xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-surface/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Candidate</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Position</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Round</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Joined</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const done = !!r.completedAt;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0',
                              done ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600',
                            )}
                          >
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">{r.name}</p>
                            <p className="text-xs text-muted truncate">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted">{r.jobTitle}</td>
                      <td className="px-6 py-4 text-muted">{r.round ?? 1}</td>
                      <td className="px-6 py-4">
                        <span className="text-muted" title={formatDate(r.joinedAt)}>
                          {timeAgo(r.joinedAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {done ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                            <UserCheck size={14} />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            In progress
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
