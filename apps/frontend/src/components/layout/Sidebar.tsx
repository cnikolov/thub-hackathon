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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import logoMark from '../../assets/logo-mark.svg';

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
          <img src={logoMark} alt="THub" className="w-10 h-10" />
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-ink">T</span>
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
