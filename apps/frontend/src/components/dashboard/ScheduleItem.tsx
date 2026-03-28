import { cn } from '../../lib/utils';

export function ScheduleItem({ 
  title, 
  subtitle, 
  time, 
  color 
}: { 
  title: string, 
  subtitle: string, 
  time: string, 
  color: string 
}) {
  return (
    <div className="flex gap-4">
      <div className={cn("w-1 shrink-0 rounded-full", color)}></div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">{title}</div>
        <div className="text-sm font-bold truncate">{subtitle}</div>
        <div className="text-xs text-muted mt-1">{time}</div>
      </div>
    </div>
  );
}
