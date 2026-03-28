import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'motion/react';
import { Layout, Plus, Sparkles } from 'lucide-react';
import { api, type ApiResult } from '../lib/api';
import type { AppOutletContext } from '../lib/outlet-context';
import type { Job } from '../lib/types';
import { JobCard } from '../components/jobs/JobCard';
import { JobCreateModal } from '../components/jobs/JobCreateModal';

export function Jobs() {
  const { selectedProjectId } = useOutletContext() as AppOutletContext;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadJobs = useCallback(async () => {
    if (selectedProjectId == null) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = `?projectId=${encodeURIComponent(String(selectedProjectId))}`;
      const res = await api.get<ApiResult<Job[]>>(`/jobs${q}`);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setJobs(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  async function seedDemoJob() {
    if (selectedProjectId == null) return;
    setSeeding(true);
    setError(null);
    try {
      const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const res = await api.post<ApiResult<Job>>('/jobs', {
        title: 'Senior React Developer',
        description:
          'We are looking for a Senior React Developer to join our core team. You will build high-performance web applications using React and TypeScript.',
        requirements:
          '5+ years of React experience, Strong TypeScript skills, Experience with Vite/Next.js, Tailwind CSS and Framer Motion.',
        projectId: selectedProjectId,
        shareCode,
        status: 'open',
        interviewType: 'technical',
        durationMinutes: 30,
        systemPrompt:
          'You are a Senior Technical Interviewer. Focus on deep technical knowledge, architectural patterns, and practical problem-solving.',
        questions: [
          { id: '1', text: 'Explain the difference between useMemo and useCallback.', isMandatory: true },
          {
            id: '2',
            text: 'How do you handle complex state in a large-scale React application?',
            isMandatory: true,
            possibleAnswers: ['Redux', 'Zustand', 'Context API', 'React Query'],
          },
          { id: '3', text: 'What is your approach to performance optimization in React?', isMandatory: true },
          { id: '4', text: 'Describe a challenging technical problem you solved recently.', isMandatory: false },
        ],
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  if (selectedProjectId == null) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-border rounded-3xl bg-card">
        <Layout className="w-12 h-12 opacity-20 mb-4 text-ink" />
        <h3 className="text-xl font-semibold mb-2 text-ink">No project selected</h3>
        <p className="text-sm text-muted max-w-xs mb-6">Create or select a project from the header to manage job postings.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-muted text-sm animate-pulse">Loading jobs…</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
    );
  }

  const pid = Number(selectedProjectId);

  return (
    <>
      <JobCreateModal
        open={modalOpen}
        projectId={pid}
        onClose={() => setModalOpen(false)}
        onCreated={loadJobs}
      />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-ink">Job postings</h2>
            <p className="text-muted text-sm mt-2">Manage and monitor your active hiring positions (SQLite + Bun API).</p>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => void seedDemoJob()}
              disabled={seeding}
              className="px-6 py-2.5 bg-surface border border-border rounded-xl font-bold text-sm hover:bg-border transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={18} className="text-primary" />
              {seeding ? 'Seeding…' : 'Seed demo job'}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Plus size={18} />
              New position
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {jobs.length === 0 ? (
            <div className="bg-card p-12 rounded-[32px] border border-border text-center">
              <p className="text-muted italic">No job postings found for this project.</p>
            </div>
          ) : (
            jobs.map((job) => <JobCard key={job.id} job={job} />)
          )}
        </div>
      </motion.div>
    </>
  );
}
