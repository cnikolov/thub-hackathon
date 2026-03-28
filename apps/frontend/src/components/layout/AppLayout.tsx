import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { api, type ApiResult } from '../../lib/api';
import type { Project } from '../../lib/types';
import { useAuth } from '../../hooks/useAuth';

export function AppLayout() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<ApiResult<Project[]>>('/projects');
      if (!res.success) {
        setError(res.error);
        return;
      }
      setProjects(res.data);
      setSelectedProjectId((prev) => {
        if (prev != null && res.data.some((p) => String(p.id) === String(prev))) {
          return prev;
        }
        return res.data[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  return (
    <div className="flex h-screen bg-surface text-ink font-sans selection:bg-primary/30 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        <Header
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={(id) => setSelectedProjectId(id)}
          loading={loading}
        />

        <div className="flex-1 overflow-y-auto p-6 sm:p-10">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <Outlet
            context={{
              selectedProjectId,
              setSelectedProjectId,
              projects,
              user,
              reloadProjects: loadProjects,
            }}
          />
        </div>
      </main>
    </div>
  );
}
