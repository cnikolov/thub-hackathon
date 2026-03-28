/** Client-side session logger that mirrors events to the server for end-to-end tracing.
 *
 * Controlled by env var:
 *   VITE_INTERVIEW_LOG=true  — enable logging (default: off)
 */

import { api } from './api';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ENABLED = import.meta.env.VITE_INTERVIEW_LOG === 'true';

let _sessionId: string | null = null;

export function initSessionLog(sessionId: string) {
  _sessionId = sessionId;
}

export function clearSessionLog() {
  _sessionId = null;
}

function send(level: LogLevel, area: string, msg: string, extra?: Record<string, unknown>) {
  if (!ENABLED) return;

  const tag = `[${level.toUpperCase()}] [client:${area}]`;
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logFn(`${tag} ${msg}`, extra ?? '');

  if (!_sessionId) return;
  api.post(`/rooms/interview-session/${_sessionId}/log`, { level, area, msg, extra }).catch(() => {});
}

export const slog = {
  debug: (area: string, msg: string, extra?: Record<string, unknown>) => send('debug', area, msg, extra),
  info: (area: string, msg: string, extra?: Record<string, unknown>) => send('info', area, msg, extra),
  warn: (area: string, msg: string, extra?: Record<string, unknown>) => send('warn', area, msg, extra),
  error: (area: string, msg: string, extra?: Record<string, unknown>) => send('error', area, msg, extra),
};
