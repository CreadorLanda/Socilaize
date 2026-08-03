import type { MessageDTO } from '@/data/api/messages';

import { getDB } from './index';

/**
 * Local message history.
 *
 * What is cached here is the *decrypted API DTO*, not the on-screen message.
 * The screen keeps building its bubbles with mapApiMessage, so there is one
 * implementation of that derivation rather than two that drift; a change to
 * how media or attachments are rendered then applies to cached history for
 * free. It also means the row survives a UI refactor untouched.
 *
 * Decryption happens once, on the way in. Replaying an E2EE envelope on every
 * open was the visible cost — a 50-message thread meant 50 keystore round
 * trips before the first bubble appeared.
 */

/** Rows older than this are dropped per chat, newest kept. */
const RETAIN_PER_CHAT = 500;

type Row = {
  server_id: number | null;
  chat_id: string;
  sender_id: string | null;
  sender_name: string | null;
  sender_avatar: string | null;
  body: string;
  message_type: string;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  status: string;
  forward_count: number;
  source_channel_id: string | null;
  source_post_id: string | null;
  expires_at: string | null;
};

function rowToDTO(r: Row): MessageDTO {
  return {
    id: Number(r.server_id),
    chat_id: r.chat_id,
    sender_id: r.sender_id ?? '',
    content: r.body,
    message_type: r.message_type,
    reply_to_id: r.reply_to_id ? Number(r.reply_to_id) : undefined,
    created_at: r.created_at,
    edited_at: r.edited_at ?? undefined,
    deleted_at: r.deleted_at ?? undefined,
    sender_name: r.sender_name ?? undefined,
    sender_avatar: r.sender_avatar ?? undefined,
    // Rebuilt from the collapsed status. mapApiMessage only ever compares
    // these against zero, so the exact recipient count is not information
    // the bubble can use — and storing one column keeps the write cheap.
    delivered_to: r.status === 'delivered' || r.status === 'read' ? 1 : 0,
    read_by: r.status === 'read' ? 1 : 0,
    forward_count: r.forward_count ?? 0,
    source_channel_id: r.source_channel_id ?? undefined,
    source_post_id: r.source_post_id ?? undefined,
    expires_at: r.expires_at ?? undefined,
  };
}

function statusOf(m: MessageDTO): string {
  if (m.read_by && m.read_by > 0) return 'read';
  if (m.delivered_to && m.delivered_to > 0) return 'delivered';
  return 'sent';
}

/**
 * Newest `limit` messages for a chat, returned oldest-first — the order the
 * chat screen renders in, so the caller never has to reverse.
 */
export async function loadCachedMessages(
  chatId: string,
  limit = 50,
): Promise<MessageDTO[]> {
  const db = await getDB();
  const res = await db.execute(
    `SELECT server_id, chat_id, sender_id, sender_name, sender_avatar, body,
            message_type, reply_to_id, created_at, edited_at, deleted_at, status,
            forward_count, source_channel_id, source_post_id, expires_at
       FROM messages
      WHERE chat_id = ? AND server_id IS NOT NULL
      ORDER BY server_id DESC
      LIMIT ?`,
    [chatId, limit],
  );
  const rows = (res.rows ?? []) as unknown as Row[];
  return rows.map(rowToDTO).reverse();
}

/**
 * Write decrypted messages through to the cache.
 *
 * `body` must already be plaintext: storing an envelope would defeat the
 * point, since the next open would have to decrypt it again anyway.
 *
 * Upsert rather than insert — a message reappears on every refresh, and its
 * receipt status changes underneath it.
 */
export async function saveCachedMessages(
  chatId: string,
  msgs: { dto: MessageDTO; body: string }[],
): Promise<void> {
  if (msgs.length === 0) return;
  const db = await getDB();

  await db.transaction(async (tx) => {
    for (const { dto, body } of msgs) {
      await tx.execute(
        `INSERT INTO messages
           (id, server_id, chat_id, sender_id, sender_name, sender_avatar, body,
            message_type, reply_to_id, created_at, edited_at, deleted_at, status, pending,
            forward_count, source_channel_id, source_post_id, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           body        = excluded.body,
           sender_name = excluded.sender_name,
           sender_avatar = excluded.sender_avatar,
           edited_at   = excluded.edited_at,
           deleted_at  = excluded.deleted_at,
           -- Origin has to be updated too, or a row cached before these
           -- columns existed would keep coming back without them.
           forward_count     = excluded.forward_count,
           source_channel_id = excluded.source_channel_id,
           source_post_id    = excluded.source_post_id,
           expires_at        = excluded.expires_at,
           -- Receipts only ever move forward. Without this guard a refresh
           -- that raced a websocket update could walk a read message back to
           -- delivered, flipping the ticks backwards on screen.
           status      = CASE
                           WHEN messages.status = 'read' THEN 'read'
                           WHEN messages.status = 'delivered'
                                AND excluded.status = 'sent' THEN 'delivered'
                           ELSE excluded.status
                         END`,
        [
          String(dto.id),
          dto.id,
          chatId,
          dto.sender_id ?? null,
          dto.sender_name ?? null,
          dto.sender_avatar ?? null,
          body,
          dto.message_type ?? 'text',
          dto.reply_to_id != null ? String(dto.reply_to_id) : null,
          dto.created_at,
          dto.edited_at ?? null,
          dto.deleted_at ?? null,
          statusOf(dto),
          dto.forward_count ?? 0,
          dto.source_channel_id ?? null,
          dto.source_post_id ?? null,
          dto.expires_at ?? null,
        ],
      );
    }
  });
}

/** Drop a message locally — mirrors a delete the user made or received. */
export async function deleteCachedMessage(messageId: string): Promise<void> {
  const db = await getDB();
  await db.execute(`DELETE FROM messages WHERE id = ?`, [messageId]);
}

/**
 * Trim a chat's history to the newest RETAIN_PER_CHAT rows.
 *
 * Unbounded growth is the failure mode nobody notices until the database is
 * hundreds of megabytes, and re-fetching old pages costs one request.
 */
export async function trimCachedChat(chatId: string): Promise<void> {
  const db = await getDB();
  await db.execute(
    `DELETE FROM messages
      WHERE chat_id = ?
        AND server_id IS NOT NULL
        AND server_id NOT IN (
          SELECT server_id FROM messages
           WHERE chat_id = ? AND server_id IS NOT NULL
           ORDER BY server_id DESC LIMIT ?
        )`,
    [chatId, chatId, RETAIN_PER_CHAT],
  );
}

/**
 * Erase all local history.
 *
 * Called on logout. The database is one file shared by whoever signs in on
 * this device, so leaving it behind would show the next account the previous
 * one's decrypted conversations.
 */
export async function wipeLocalHistory(): Promise<void> {
  const db = await getDB();
  await db.transaction(async (tx) => {
    await tx.execute('DELETE FROM messages');
    await tx.execute('DELETE FROM chats');
    await tx.execute('DELETE FROM sync_cursors');
    await tx.execute('DELETE FROM outbox');
  });
}
