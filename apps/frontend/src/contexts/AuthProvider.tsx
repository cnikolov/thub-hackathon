import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { API_BASE, getStoredToken, setStoredToken } from '../lib/api';
import type { User } from './auth-types';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(() => getStoredToken() === null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    let cancelled = false;
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error('session');
        return r.json() as Promise<{
          user: { sub: string; email?: string; displayName?: string };
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        const u = data.user;
        const email = u.email ?? '';
        setUser({
          uid: u.sub,
          email,
          displayName: u.displayName ?? email.split('@')[0] ?? 'User',
        });
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Login failed');
    const data = (await res.json()) as {
      token: string;
      user: { id: string; email: string; displayName?: string };
    };
    setStoredToken(data.token);
    setUser({
      uid: data.user.id,
      email: data.user.email,
      displayName: data.user.displayName ?? data.user.email.split('@')[0] ?? 'User',
    });
    setIsReady(true);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setIsReady(true);
  }, []);

  const value = useMemo(
    () => ({ user, isReady, login, logout }),
    [user, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
