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
