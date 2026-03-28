/** Minimal reconnecting WebSocket client for real-time interview events. */

import { API_BASE } from './api';

export type InterviewWsEvent =
  | { type: 'assessment'; score: number; notes: string }
  | { type: 'phase'; phase: string }
  | { type: 'checklist'; items: { id: string; label: string; required: boolean; covered: boolean }[] }
  | { type: 'unmute' }
  | { type: 'block'; seconds: number }
  | { type: 'complete'; transcript: string; assessmentLog: string[] };

type Listener = (event: InterviewWsEvent) => void;

function buildWsUrl(sessionId: string): string {
  const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (wsUrl) return `${wsUrl.replace(/\/$/, '')}/interview/${sessionId}`;

  // Derive from the HTTP API base: /api → ws://host/ws, absolute → swap protocol
  if (API_BASE.startsWith('/')) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws/interview/${sessionId}`;
  }
  const abs = API_BASE.replace(/^http/, 'ws');
  return `${abs.replace(/\/$/, '').replace(/\/api$/, '')}/ws/interview/${sessionId}`;
}

/**
 * Open a WebSocket to the interview session and invoke `onEvent` for every
 * server-pushed message.  Returns a teardown function.
 *
 * Auto-reconnects with exponential back-off (500 ms → 8 s cap).
 */
export function connectInterviewWs(sessionId: string, onEvent: Listener): () => void {
  const url = buildWsUrl(sessionId);
  let ws: WebSocket | null = null;
  let dead = false;
  let retryMs = 500;

  function connect() {
    if (dead) return;
    ws = new WebSocket(url);

    ws.onopen = () => {
      retryMs = 500;
    };

    ws.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data as string) as InterviewWsEvent);
      } catch { /* bad JSON — ignore */ }
    };

    ws.onclose = () => {
      if (dead) return;
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 8000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return () => {
    dead = true;
    ws?.close();
  };
}
