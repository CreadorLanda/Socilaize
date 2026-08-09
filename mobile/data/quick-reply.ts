import { getGroup } from '@/data/api/groups';
import { listChats, sendMessage as apiSendMessage } from '@/data/api/messages';
import {
  E2EEUnavailable,
  encryptForGroup,
  encryptForPeerOrFail,
  ensureKeysPublished,
  groupEpoch,
} from '@/data/crypto';

/**
 * Send a reply typed into a notification, without opening the app.
 *
 * The hard part is not the sending — it is that this runs outside the chat
 * screen, where the encryption helper lives. Reusing the same primitives
 * rather than reaching for the plaintext send is the whole point: a reply
 * from the lock screen must be exactly as protected as one typed in the
 * conversation, or the notification becomes a way around the encryption.
 *
 * Everything it needs is fetched fresh: the chat's peer, or the group's
 * members and key epoch. That costs a round trip, but a quick reply happens
 * once in a while and correctness matters more than the millisecond.
 */
export async function sendQuickReply(chatId: string, text: string): Promise<void> {
  const body = text.trim();
  if (!body) return;

  await ensureKeysPublished();

  // There is no single-chat endpoint, and inventing one for this would be a
  // server change for a rare path. The list is small and already cached by
  // the API layer's own semantics.
  const chat = (await listChats()).find((c) => c.id === chatId);
  if (!chat) throw new E2EEUnavailable('peer_unknown');

  let payload: string;
  if (chat.type === 'group') {
    const members = ((await getGroup(chatId)).members ?? []).map((m) => ({
      user_id: m.user_id,
      username: m.username,
    }));
    if (members.length === 0) throw new E2EEUnavailable('peer_unknown');
    payload = await encryptForGroup(chatId, body, members, await groupEpoch(chatId));
  } else {
    if (!chat.peer_user_id) throw new E2EEUnavailable('peer_unknown');
    payload = await encryptForPeerOrFail(chat.peer_user_id, body, {
      peerUsername: chat.peer_username,
    });
  }

  await apiSendMessage(chatId, payload, 'text');
}
