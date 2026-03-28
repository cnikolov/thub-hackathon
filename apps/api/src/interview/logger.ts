/** Structured interview session logger.
 *
 * Controlled by env vars:
 *   INTERVIEW_LOG=true     — enable logging (default: off)
 *   LOG_LEVEL=debug|info|warn|error  — minimum level (default: debug)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_TAG: Record<LogLevel, string> = { debug: 'DBG', info: 'INF', warn: 'WRN', error: 'ERR' };

const ENABLED = process.env.INTERVIEW_LOG === 'true';
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'debug';

function ts(): string {
  return new Date().toISOString();
}

function fmt(level: LogLevel, sessionId: string | null, area: string, msg: string, extra?: Record<string, unknown>): string {
  const sid = sessionId ? sessionId.slice(0, 8) : '--------';
  const base = `${ts()} [${LEVEL_TAG[level]}] [${sid}] [${area}] ${msg}`;
  if (extra && Object.keys(extra).length > 0) {
    return `${base} ${JSON.stringify(extra)}`;
  }
  return base;
}

function shouldLog(level: LogLevel): boolean {
  return ENABLED && LEVEL_RANK[level] >= LEVEL_RANK[MIN_LEVEL];
}

function createSessionLogger(sessionId: string) {
  return {
    debug: (area: string, msg: string, extra?: Record<string, unknown>) => {
      if (shouldLog('debug')) console.debug(fmt('debug', sessionId, area, msg, extra));
    },
    info: (area: string, msg: string, extra?: Record<string, unknown>) => {
      if (shouldLog('info')) console.log(fmt('info', sessionId, area, msg, extra));
    },
    warn: (area: string, msg: string, extra?: Record<string, unknown>) => {
      if (shouldLog('warn')) console.warn(fmt('warn', sessionId, area, msg, extra));
    },
    error: (area: string, msg: string, extra?: Record<string, unknown>) => {
      if (shouldLog('error')) console.error(fmt('error', sessionId, area, msg, extra));
    },
  };
}

export type SessionLogger = ReturnType<typeof createSessionLogger>;

const loggers = new Map<string, SessionLogger>();

export function log(sessionId: string): SessionLogger {
  let l = loggers.get(sessionId);
  if (!l) {
    l = createSessionLogger(sessionId);
    loggers.set(sessionId, l);
  }
  return l;
}

export function dropLogger(sessionId: string) {
  loggers.delete(sessionId);
}

/** Global log (no session context). */
export const glog = {
  debug: (area: string, msg: string, extra?: Record<string, unknown>) => {
    if (shouldLog('debug')) console.debug(fmt('debug', null, area, msg, extra));
  },
  info: (area: string, msg: string, extra?: Record<string, unknown>) => {
    if (shouldLog('info')) console.log(fmt('info', null, area, msg, extra));
  },
  warn: (area: string, msg: string, extra?: Record<string, unknown>) => {
    if (shouldLog('warn')) console.warn(fmt('warn', null, area, msg, extra));
  },
  error: (area: string, msg: string, extra?: Record<string, unknown>) => {
    if (shouldLog('error')) console.error(fmt('error', null, area, msg, extra));
  },
};
