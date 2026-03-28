import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Users,
  Mail,
  Calendar,
  CheckSquare,
  TrendingUp,
  Settings,
  LogOut,
  BarChart3,
  Mic,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

function SidebarItem({
  icon,
  label,
  to,
}: {
  icon: ReactNode;
  label: string;
  to: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all group',
          isActive
            ? 'bg-primary/10 text-primary font-semibold'
            : 'text-muted hover:bg-surface hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'transition-colors',
              isActive ? 'text-primary' : 'text-muted group-hover:text-ink',
            )}
          >
            {icon}
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="w-64 sm:w-72 bg-card border-r border-border flex flex-col h-full shrink-0">
      <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 mb-10">
          <svg
            viewBox="0 0 48 48"
            className="w-10 h-10 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
          >
            <style>{`
              @keyframes shimmer {
                0%, 30% { transform: translateX(-15px) skewX(-20deg); opacity: 0; }
                50% { opacity: 0.35; }
                70%, 100% { transform: translateX(55px) skewX(-20deg); opacity: 0; }
              }
              .logo-shimmer { animation: shimmer 4s ease-in-out infinite; }
            `}</style>
            <defs>
              <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#0d9488" />
              </linearGradient>
              <clipPath id="t-shape">
                <rect x="10" y="10" width="28" height="7" rx="3.5" />
                <rect x="18.5" y="10" width="11" height="29" rx="3.5" />
              </clipPath>
            </defs>
            <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#logo-bg)" />
            <rect x="10" y="10" width="28" height="7" rx="3.5" fill="#fff" />
            <rect x="18.5" y="10" width="11" height="29" rx="3.5" fill="#fff" />
            <g clipPath="url(#t-shape)">
              <rect className="logo-shimmer" y="0" width="12" height="48" fill="#fff" />
            </g>
          </svg>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-[#0d9488]">T</span>
            <span className="text-primary">Hub</span>
          </h1>
        </div>

        <div className="space-y-1">
          <p className="px-4 text-[10px] font-bold text-muted uppercase tracking-widest mb-4">
            Main Menu
          </p>
          <nav className="space-y-1">
            <SidebarItem icon={<BarChart3 size={20} />} label="Dashboard" to="/dashboard" />
            <SidebarItem icon={<Briefcase size={20} />} label="Job Postings" to="/jobs" />
            <SidebarItem icon={<Users size={20} />} label="Candidates" to="/candidates" />
            <SidebarItem icon={<Mic size={20} />} label="Open interview" to="/interview" />
            <SidebarItem icon={<Mail size={20} />} label="Inbox" to="/inbox" />
            <SidebarItem icon={<Calendar size={20} />} label="Calendar" to="/calendar" />
          </nav>

          <p className="px-4 text-[10px] font-bold text-muted uppercase tracking-widest mt-10 mb-4">
            Organization
          </p>
          <nav className="space-y-1">
            <SidebarItem icon={<CheckSquare size={20} />} label="Attendance" to="/attendance" />
            <SidebarItem icon={<TrendingUp size={20} />} label="Performance" to="/performance" />
            <SidebarItem icon={<Settings size={20} />} label="Settings" to="/settings" />
          </nav>
        </div>
      </div>

      <div className="mt-auto p-6 sm:p-8 border-t border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-ink font-bold">
            {user?.displayName?.charAt(0) ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{user?.displayName ?? 'User'}</p>
            <p className="text-xs text-muted truncate">{user?.email ?? ''}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
