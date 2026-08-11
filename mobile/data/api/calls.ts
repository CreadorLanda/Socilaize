import { api } from './client';

/**
 * What the client needs to join a call room.
 *
 * The server signs who may join and nothing more — it never sees a media
 * packet, and it never learns the key those packets are encrypted with.
 */
export type CallGrant = {
  /** The SFU to dial. Sent per request so moving it needs no new build. */
  url: string;
  room: string;
  token: string;
  identity: string;
  expires_at: string;
};

/**
 * Fetched immediately before joining, never cached.
 *
 * The token lives five minutes by design; holding one is holding a key to a
 * room, and a stale one only produces a confusing failure at the worst
 * moment.
 */
export function callToken(
  chatId: string,
  opts: { ring?: boolean; mode?: 'voice' | 'video' } = {},
) {
  // `ring` separates starting a call from answering one. Both fetch a token;
  // only the caller asks the server to make the other phones ring, or the
  // person picking up would hear their own ringtone.
  const q = new URLSearchParams();
  if (opts.ring) q.set('ring', '1');
  if (opts.mode) q.set('mode', opts.mode);
  const qs = q.toString();
  return api.post<CallGrant>(`/api/chats/${chatId}/call/token${qs ? `?${qs}` : ''}`, {});
}

/** One row of the call log, as this user sees it. */
export type CallLogEntry = {
  id: string;
  chat_id: string;
  caller_id: string;
  caller_name: string;
  mode: 'voice' | 'video';
  started_at: string;
  ended_at?: string;
  /** Still going — the row offers to join rather than to call back. */
  running: boolean;
  /**
   * `ringing` means live and not yet joined. It is deliberately not `missed`:
   * a call is only missed once it has ended without you, and reporting a live
   * one as missed would hide the single call the log can actually help with.
   */
  outcome: 'answered' | 'declined' | 'missed' | 'ringing';
  mine: boolean;
  duration_sec: number;
  participants: number;
};

export function callHistory() {
  return api.get<CallLogEntry[]>('/api/calls');
}

/**
 * Report leaving the call.
 *
 * Disconnecting from the SFU tells the server nothing — it only ever heard
 * about a call starting. Without this the call ran until the four-hour sweep:
 * the log showed multi-hour durations for calls that lasted seconds, offered
 * to "join" a room that had been empty since the night before, and folded a
 * second call in the same chat into the first.
 *
 * Sent on the way out and never awaited for correctness. The server treats a
 * repeat as a no-op.
 */
export function hangupCall(chatId: string) {
  return api.post<void>(`/api/chats/${chatId}/call/hangup`, {});
}

/** Say no explicitly, which reads differently in the log from never answering. */
export function declineCall(chatId: string) {
  return api.post<void>(`/api/chats/${chatId}/call/decline`, {});
}

/**
 * Pull people into a call already running.
 *
 * The conversation is not touched: a one-to-one chat stays a one-to-one chat
 * and the guest list belongs to the call.
 */
export function inviteToCall(chatId: string, userIds: string[]) {
  return api.post<{ invited: number }>(`/api/chats/${chatId}/call/invite`, {
    user_ids: userIds,
  });
}
