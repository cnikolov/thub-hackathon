import { Mic } from 'lucide-react';
import type { JobInterviewStep } from '../../lib/types';

/** Per-company brand color — in a real product this comes from the project settings. */
const DEFAULT_BRAND_COLOR = '#001A72';

export type PreInterviewProps = {
  jobTitle: string;
  logoUrl: string;
  steps: JobInterviewStep[];
  name: string;
  email: string;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onJoin: () => void;
  joining: boolean;
  disabled: boolean;
  /** Company-specific accent color for buttons / highlights. */
  brandColor?: string;
};

export function PreInterview({
  jobTitle,
  logoUrl,
  steps,
  name,
  email,
  onNameChange,
  onEmailChange,
  onJoin,
  joining,
  disabled,
  brandColor = DEFAULT_BRAND_COLOR,
}: PreInterviewProps) {
  const ready = !!name.trim() && !!email.trim();

  const btnStyle = {
    backgroundColor: ready && !disabled ? brandColor : undefined,
    boxShadow: ready && !disabled ? `0 8px 24px ${brandColor}33` : undefined,
  };

  const accentBg10 = { backgroundColor: `${brandColor}1A` };
  const accentText = { color: brandColor };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
      {/* ── Left: lobby ── */}
      <div className="lg:w-[340px] shrink-0 space-y-6">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Company logo" className="w-10 h-10 rounded-xl object-contain" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold tracking-tight text-ink truncate">{jobTitle}</h3>
            <p className="text-xs text-muted">
              Voice interview{steps.length > 1 ? ` · ${steps.length} rounds` : ''}
            </p>
          </div>
        </div>

        {/* Who's here */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
            In this interview
          </p>

          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ ...accentBg10, ...accentText }}>
                <Mic size={18} />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-surface" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">AI Interviewer</p>
              <p className="text-[11px] text-green-600 font-medium">Online — ready</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-muted font-bold text-sm">
                {name ? name.charAt(0).toUpperCase() : '?'}
              </div>
              {ready ? (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-surface" />
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-300 rounded-full border-2 border-surface" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{name || 'You'}</p>
              <p className="text-[11px] text-muted font-medium">
                {ready ? 'Ready to join' : 'Fill in your details to join'}
              </p>
            </div>
          </div>
        </div>

        {/* What you're jumping into */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
            What to expect
          </p>
          {steps.length > 1 ? (
            <ol className="space-y-2 text-sm">
              {steps.map((s, i) => (
                <li key={s.id ?? `step-${i}`} className="flex items-baseline gap-2">
                  <span
                    className="w-5 h-5 rounded-lg text-[10px] font-bold flex items-center justify-center shrink-0"
                    style={{ ...accentBg10, ...accentText }}
                  >
                    {i + 1}
                  </span>
                  <span className="font-medium text-ink">{s.title}</span>
                  {s.durationMinutes ? (
                    <span className="text-xs text-muted ml-auto">~{s.durationMinutes}m</span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <ul className="space-y-2 text-sm text-muted">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandColor }} />
                Voice conversation with an AI interviewer
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandColor }} />
                ~{steps[0]?.durationMinutes ?? 15} minutes
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandColor }} />
                Microphone required — find a quiet spot
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* ── Right: join form ── */}
      <div className="flex-1 flex items-start justify-center lg:pt-4">
        <div className="w-full max-w-sm space-y-5 bg-surface p-6 rounded-[28px] border border-border">
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">
              Join as
            </p>
            <p className="text-xs text-muted">
              Your name and email are shared with the hiring team.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 px-1">
                Full name
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-primary/50 transition-all"
                style={{ '--tw-ring-color': `${brandColor}33` } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 px-1">
                Email address
              </label>
              <input
                type="email"
                placeholder="e.g. john@example.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-primary/50 transition-all"
                style={{ '--tw-ring-color': `${brandColor}33` } as React.CSSProperties}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onJoin}
            disabled={disabled || !ready}
            className="w-full py-4 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:shadow-none disabled:bg-gray-300"
            style={btnStyle}
          >
            {joining ? (
              <span className="animate-pulse">Connecting…</span>
            ) : (
              <>
                <Mic size={18} />
                {steps.length > 1
                  ? `Join round 1 — ${steps[0]?.title ?? 'Interview'}`
                  : 'Join interview'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
