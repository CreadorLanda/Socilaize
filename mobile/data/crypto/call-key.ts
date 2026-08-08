import { b64urlToBytes, bytesToB64url } from './encoding';
import { deriveSharedSecret, loadSession } from './session';

/**
 * The key that encrypts a call's audio and video.
 *
 * LiveKit relays media it cannot read when the participants hold a shared
 * key it was never given. That key is derived here, on the devices, from the
 * pairwise session the chat already uses — so a call is protected by exactly
 * the same secret as the messages in it, and the SFU sits in the middle
 * forwarding noise.
 *
 * Derived rather than transmitted. Sending a call key over the signalling
 * channel would put it in reach of the server that signs the join tokens,
 * which is the one participant nobody agreed to include.
 */
export async function callKeyFor(chatId: string, peerUserId: string): Promise<string | null> {
  const session = await loadSession(peerUserId);
  if (!session) return null;

  // Bound to the room: two chats with the same peer must not share a call
  // key, and neither must two calls in the same chat reuse one after a
  // re-key of the underlying session.
  const secret = deriveSharedSecret(b64urlToBytes(session.rootKey), `call:${chatId}`);
  return bytesToB64url(secret);
}

/** Present for the caller to show that the media really is protected. */
export function callKeyFingerprint(key: string): string {
  const b = b64urlToBytes(key);
  return Array.from(b.slice(0, 4))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
