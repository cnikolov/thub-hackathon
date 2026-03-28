import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { api, type ApiResult } from '../../lib/api';
import type { Project } from '../../lib/types';
import { cn } from '../../lib/utils';

export function NewProjectModal({
  open,
  ownerId,
  onClose,
  onCreated,
}: {
  open: boolean;
  ownerId: string;
  onClose: () => void;
  onCreated: (project: Project) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const res = await api.post<ApiResult<Project>>('/projects', {
        name: name.trim(),
        description: description.trim() || undefined,
        ownerId,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setName('');
      setDescription('');
      await onCreated(res.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => !saving && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-3xl border border-border bg-card p-8 card-shadow"
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-ink">New project</h2>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="rounded-lg p-1 text-muted hover:text-ink hover:bg-surface"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="project-name" className="block text-xs font-semibold text-muted mb-1.5">
              Name
            </label>
            <input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              placeholder="e.g. Product Design Team"
              autoFocus
              required
            />
          </div>
          <div>
            <label htmlFor="project-desc" className="block text-xs font-semibold text-muted mb-1.5">
              Description (optional)
            </label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 resize-none"
              placeholder="Short summary for your team"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => !saving && onClose()}
              className="px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={cn(
                'px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20',
                (saving || !name.trim()) && 'opacity-60 pointer-events-none',
              )}
            >
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
