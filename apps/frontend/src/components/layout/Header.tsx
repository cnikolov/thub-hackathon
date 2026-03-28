import { ChevronDown, Search, Bell } from 'lucide-react';

export function Header({
  projects = [],
  selectedProjectId,
  onProjectChange,
  loading = false,
}: {
  projects?: { id: string | number; name: string }[];
  selectedProjectId?: string | number | null;
  onProjectChange?: (id: string | number) => void;
  loading?: boolean;
}) {
  return (
    <header className="h-20 border-b border-border flex items-center justify-between px-6 sm:px-10 bg-card/95 backdrop-blur-md z-10 shrink-0 shadow-sm shadow-slate-900/5">
      <div className="flex items-center gap-6 min-w-0">
        <div className="relative min-w-0">
          <select
            value={selectedProjectId ?? ''}
            disabled={loading || projects.length === 0}
            onChange={(e) => onProjectChange?.(e.target.value)}
            className="appearance-none bg-surface border border-border rounded-xl pl-4 pr-10 py-2 text-sm font-semibold outline-none cursor-pointer hover:border-primary/50 transition-colors max-w-[min(100vw-8rem,280px)] truncate disabled:opacity-60"
          >
            {projects.length === 0 && !loading && <option value="">No projects</option>}
            {loading && <option value="">Loading projects…</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
            size={16}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6 shrink-0">
        <div className="relative group hidden md:block">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors"
            size={18}
          />
          <input
            type="search"
            placeholder="Search…"
            className="bg-surface border border-border rounded-2xl pl-12 pr-6 py-2.5 text-sm outline-none w-56 lg:w-80 focus:ring-2 focus:ring-primary/10 focus:border-primary/50 transition-all"
          />
        </div>

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-muted hover:text-ink transition-colors relative"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-card" />
        </button>
      </div>
    </header>
  );
}
