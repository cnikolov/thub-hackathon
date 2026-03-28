import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Layout, LogOut, ChevronRight, Mic } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { user, isReady, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('admin@teamhub.local');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interviewCode, setInterviewCode] = useState(() => searchParams.get('code')?.toUpperCase() ?? '');

  if (isReady && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim() || 'admin@teamhub.local');
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Could not sign in. Is the API running?');
    } finally {
      setBusy(false);
    }
  }

  function goInterview() {
    const c = interviewCode.trim().toUpperCase();
    if (!c) return;
    navigate(`/interview?code=${encodeURIComponent(c)}`);
  }

  if (!isReady) {
    return (
      <div className="h-svh w-full flex items-center justify-center bg-surface font-mono text-sm text-muted">
        LOADING_SYSTEM…
      </div>
    );
  }

  return (
    <div className="min-h-svh w-full flex flex-col items-center justify-center bg-surface p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card rounded-[40px] p-12 card-shadow border border-border text-center"
      >
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-primary/20">
          <Layout size={32} />
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2 text-ink">TeamHub</h1>
        <p className="text-muted text-sm mb-10">Modern HR Management System</p>

        <form onSubmit={handleSignIn} className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface border border-border rounded-2xl px-4 py-3 text-sm text-left outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="you@company.com"
            autoComplete="email"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/20 disabled:opacity-60"
          >
            <LogOut size={18} className="rotate-180" />
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
            <span className="bg-card px-4 text-muted">Candidate access</span>
          </div>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Interview code"
            value={interviewCode}
            onChange={(e) => setInterviewCode(e.target.value.toUpperCase())}
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            type="button"
            onClick={goInterview}
            className="w-12 h-12 flex items-center justify-center bg-ink text-white rounded-xl hover:bg-opacity-90 transition-all"
            aria-label="Start interview"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate('/interview')}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary hover:bg-primary/5 rounded-xl transition-colors"
        >
          <Mic size={18} />
          Open interview
        </button>
      </motion.div>
    </div>
  );
}
