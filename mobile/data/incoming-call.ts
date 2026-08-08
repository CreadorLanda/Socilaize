import { useSyncExternalStore } from 'react';

/**
 * The call that is ringing right now, if any.
 *
 * A store rather than screen state because a call can arrive while any screen
 * is on top — or none. The websocket handlers that already exist feed it; the
 * host component in the root layout renders it. Neither has to know about the
 * other.
 */
export type IncomingCall = {
  chatId: string;
  callerId: string;
  callerName: string;
  mode: 'voice' | 'video';
  /** When it started ringing, so a stale one can be dropped. */
  at: number;
};

/**
 * How long an unanswered call keeps ringing.
 *
 * Without this a call that the caller abandoned rings until someone touches
 * the screen — and worse, a `call.incoming` that arrives while the app was
 * backgrounded would ring on return, for a call that ended minutes ago.
 */
const RING_TIMEOUT_MS = 45_000;

let current: IncomingCall | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function ringIncoming(call: Omit<IncomingCall, 'at'>): void {
  // A second ring for the same chat is the same call — the caller may retry,
  // or two listeners may both see the event.
  if (current?.chatId === call.chatId) return;
  current = { ...call, at: Date.now() };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => dismissIncoming(), RING_TIMEOUT_MS);
  emit();
}

export function dismissIncoming(): void {
  if (!current) return;
  current = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  emit();
}

/** Drop any ringing call — called on logout so nothing outlives the account. */
export function resetIncomingCall(): void {
  dismissIncoming();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useIncomingCall(): IncomingCall | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/**
 * Feed the store from a realtime event.
 *
 * Exported so every websocket handler can call it without knowing the shape
 * of the store — there are two of them today and there will be more.
 */
export function handleCallEvent(type: string, payload: unknown): boolean {
  if (type !== 'call.incoming') return false;
  const p = payload as Record<string, string> | null | undefined;
  if (!p?.chat_id || !p?.caller_id) return false;
  ringIncoming({
    chatId: p.chat_id,
    callerId: p.caller_id,
    callerName: p.caller_name || '',
    mode: p.mode === 'video' ? 'video' : 'voice',
  });
  return true;
}
