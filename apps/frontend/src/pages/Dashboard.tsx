import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Users, Check, FileText, Briefcase } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { StatCard } from '../components/dashboard/StatCard';
import { ScheduleItem } from '../components/dashboard/ScheduleItem';
import { NewProjectModal } from '../components/projects/NewProjectModal';
import { useAuth } from '../hooks/useAuth';
import { api, type ApiResult } from '../lib/api';
import type { AppOutletContext } from '../lib/outlet-context';

type StatBlock = {
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
};

type DashboardStats = {
  totalEmployees: StatBlock;
  attendance: StatBlock;
  leaveRequests: StatBlock;
  jobApplicants: StatBlock;
  schedules: {
    id: string;
    title: string;
    subtitle: string;
    time: string;
    color: string;
  }[];
  satisfactionRate: number;
};

export function Dashboard() {
  const { user } = useAuth();
  const { reloadProjects, setSelectedProjectId, selectedProjectId } = useOutletContext() as AppOutletContext;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const q =
          selectedProjectId != null
            ? `?projectId=${encodeURIComponent(String(selectedProjectId))}`
            : '';
        const res = await api.get<ApiResult<DashboardStats>>(`/dashboard/stats${q}`);
        if (res.success) {
          setStats(res.data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [selectedProjectId]);

  if (loading) {
    return <div className="animate-pulse text-muted text-sm">Loading dashboard…</div>;
  }

  return (
    <>
      <NewProjectModal
        open={projectModalOpen}
        ownerId={user?.uid ?? 'local-user'}
        onClose={() => setProjectModalOpen(false)}
        onCreated={async (project) => {
          await reloadProjects();
          setSelectedProjectId(project.id);
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-10 text-left"
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <p className="text-muted text-sm mb-1">
              Hello {user?.displayName?.split(' ')[0] ?? 'there'}!
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-ink">Good morning</h2>
          <p className="text-muted text-sm mt-2">
              You&apos;re part of a <span className="text-primary font-semibold">growing team!</span> Stats come from the Bun API; data lives in SQLite.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setProjectModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={18} />
              New project
            </button>
          </div>
        </div>

        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                label="Workspaces"
                value={stats.totalEmployees.value}
                change={stats.totalEmployees.change}
                trend={stats.totalEmployees.trend}
                icon={<Users size={20} />}
              />
              <StatCard
                label="Open roles"
                value={stats.attendance.value}
                change={stats.attendance.change}
                trend={stats.attendance.trend}
                icon={<Check size={20} />}
              />
              <StatCard
                label="Pending reviews"
                value={stats.leaveRequests.value}
                change={stats.leaveRequests.change}
                trend={stats.leaveRequests.trend}
                icon={<FileText size={20} />}
              />
              <StatCard
                label="Pipeline"
                value={stats.jobApplicants.value}
                change={stats.jobApplicants.change}
                trend={stats.jobApplicants.trend}
                icon={<Briefcase size={20} />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-card p-8 rounded-3xl card-shadow border border-border">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="font-bold text-lg text-ink">Attendance Report</h3>
                    <select className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs outline-none">
                      <option>This Month</option>
                    </select>
                  </div>
                  <div className="h-64 flex items-center justify-center text-muted text-sm italic">
                    Chart placeholder
                  </div>
                </div>

                <div className="bg-card p-8 rounded-3xl card-shadow border border-border">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="font-bold text-lg text-ink">Team Performance</h3>
                    <select className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs outline-none">
                      <option>Last 6 Months</option>
                    </select>
                  </div>
                  <div className="h-64 flex items-center justify-center text-muted text-sm italic">
                    Chart placeholder
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-card p-8 rounded-3xl card-shadow border border-border">
                  <h3 className="font-bold text-lg text-ink mb-6">Schedules</h3>
                  <div className="space-y-6">
                    {stats.schedules.map((schedule) => (
                      <ScheduleItem
                        key={schedule.id}
                        title={schedule.title}
                        subtitle={schedule.subtitle}
                        time={schedule.time}
                        color={schedule.color}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-card p-8 rounded-3xl card-shadow border border-border">
                  <h3 className="font-bold text-lg text-ink mb-6">Avg. interview score</h3>
                  <div className="flex flex-col items-center py-4">
                    <div className="text-4xl font-bold mb-1 text-ink">{stats.satisfactionRate}%</div>
                    <div className="text-muted text-xs">From scored candidates</div>
                    <div className="mt-6 w-full h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${stats.satisfactionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}
