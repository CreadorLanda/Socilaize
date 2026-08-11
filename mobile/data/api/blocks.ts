import { api } from './client';

/**
 * Blocking, which belongs to a person rather than to a conversation.
 *
 * It used to be `chats.status = 'blocked'`, set with no user: symmetric, so
 * blocking someone also stopped you writing to them, and permanent, because no
 * unblock existed anywhere. It also only ever reached the message send path, so
 * someone you blocked could still ring you.
 *
 * What a block does now, and deliberately does not:
 *
 *   one-to-one messages   stopped
 *   one-to-one calls      stopped — the phone does not ring
 *   groups                unaffected; the app tells you who in the room you
 *                         blocked
 *   lives                 unaffected, for the same reason
 */

export type BlockedUser = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_uri?: string;
  created_at: string;
};

/** Everyone you have blocked. */
export function listBlocks() {
  return api.get<BlockedUser[]>('/api/blocks');
}

/** Block a person. Idempotent — pressing it twice is one block. */
export function blockUser(userId: string) {
  return api.post<void>('/api/blocks', { user_id: userId });
}

/**
 * Lift your own block.
 *
 * Only yours: a mutual block is two decisions, and lifting one must not lift
 * the other's. Idempotent — unblocking someone who is not blocked is the state
 * you asked for.
 */
export function unblockUser(userId: string) {
  return api.del<void>(`/api/blocks/${userId}`);
}
