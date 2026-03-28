import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function StatCard({
  label,
  value,
  change,
  trend,
  icon,
}: {
  label: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: ReactNode;
}) {
  return (
    <div className="bg-card p-6 rounded-3xl card-shadow border border-border">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-muted">
          {icon}
        </div>
        <div className={cn(
          "text-[10px] font-bold px-2 py-1 rounded-lg",
          trend === 'up' ? "bg-green-100 text-green-600" : 
          trend === 'down' ? "bg-red-100 text-red-600" : 
          "bg-surface text-muted"
        )}>
          {change}
        </div>
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-muted text-xs">{label}</div>
    </div>
  );
}
