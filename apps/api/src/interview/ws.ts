/** Lightweight WebSocket hub for pushing real-time interview events to clients. */

import type { ServerWebSocket } from 'bun';
import type { ChecklistProgress, InterviewPhase } from './sessions';
import { log } from './logger';

export type WsData = { sessionId: string };

export type InterviewWsEvent =
  | { type: 'assessment'; score: number; notes: string }
  | { type: 'phase'; phase: InterviewPhase }
  | { type: 'checklist'; items: ChecklistProgress[] }
  | { type: 'lock' }
  | { type: 'unmute' }
  | { type: 'block'; seconds: number }
  | { type: 'complete'; transcript: string; assessmentLog: string[] };

const subs = new Map<string, Set<ServerWebSocket<WsData>>>();

export function subscribe(ws: ServerWebSocket<WsData>) {
  const { sessionId } = ws.data;
  let set = subs.get(sessionId);
  if (!set) {
    set = new Set();
    subs.set(sessionId, set);
  }
  set.add(ws);
}

export function unsubscribe(ws: ServerWebSocket<WsData>) {
  const { sessionId } = ws.data;
  const set = subs.get(sessionId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) subs.delete(sessionId);
}

export function broadcast(sessionId: string, event: InterviewWsEvent) {
  const set = subs.get(sessionId);
  if (!set || set.size === 0) return;
  log(sessionId).debug('ws', `broadcast ${event.type}`, event.type === 'assessment' ? { score: event.score } : undefined);
  const json = JSON.stringify(event);
  for (const ws of set) {
    try {
      ws.send(json);
    } catch { /* client disconnected */ }
  }
}

export const websocketHandler = {
  open(ws: ServerWebSocket<WsData>) {
    subscribe(ws);
  },
  message(_ws: ServerWebSocket<WsData>, _msg: string | Buffer) {
    // No inbound messages needed — sessionId comes from the URL at upgrade time.
  },
  close(ws: ServerWebSocket<WsData>) {
    unsubscribe(ws);
  },
};
