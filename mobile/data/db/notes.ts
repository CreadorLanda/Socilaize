import { getDB } from './index';

/**
 * Private notes about a conversation.
 *
 * Device-local and encrypted at rest. Nothing here is ever sent anywhere —
 * see the schema comment for why that matters more here than elsewhere.
 */

export type ChatNote = {
  chatId: string;
  body: string;
  updatedAt: string;
};

export async function getNote(chatId: string): Promise<ChatNote | null> {
  const db = await getDB();
  const res = await db.execute(
    'SELECT chat_id, body, updated_at FROM chat_notes WHERE chat_id = ?',
    [chatId],
  );
  const row = res.rows?.[0] as
    | { chat_id: string; body: string; updated_at: string }
    | undefined;
  return row ? { chatId: row.chat_id, body: row.body, updatedAt: row.updated_at } : null;
}

/** Saving an empty note deletes it, so a cleared note leaves no trace. */
export async function setNote(chatId: string, body: string): Promise<void> {
  const db = await getDB();
  const trimmed = body.trim();
  if (!trimmed) {
    await db.execute('DELETE FROM chat_notes WHERE chat_id = ?', [chatId]);
    return;
  }
  await db.execute(
    `INSERT INTO chat_notes (chat_id, body, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    [chatId, trimmed, new Date().toISOString()],
  );
}

/** Every chat that has a note, for showing a marker in lists. */
export async function chatsWithNotes(): Promise<Set<string>> {
  const db = await getDB();
  const res = await db.execute('SELECT chat_id FROM chat_notes');
  return new Set(((res.rows ?? []) as { chat_id: string }[]).map((r) => r.chat_id));
}

/**
 * Find chats by what was written about them.
 *
 * Falls back to a LIKE scan when the FTS query is something the tokenizer
 * rejects — a lone quote or a bare operator throws rather than matching
 * nothing, and a search box should never be able to crash on a keystroke.
 */
export async function searchNotes(query: string): Promise<ChatNote[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const db = await getDB();

  try {
    const res = await db.execute(
      `SELECT n.chat_id, n.body, n.updated_at
         FROM chat_notes_fts f
         JOIN chat_notes n ON n.rowid = f.rowid
        WHERE chat_notes_fts MATCH ?
        LIMIT 20`,
      [`${q.replace(/["*]/g, '')}*`],
    );
    return mapNotes(res.rows);
  } catch {
    const res = await db.execute(
      `SELECT chat_id, body, updated_at FROM chat_notes
        WHERE body LIKE ? LIMIT 20`,
      [`%${q}%`],
    );
    return mapNotes(res.rows);
  }
}

function mapNotes(rows: unknown): ChatNote[] {
  return ((rows ?? []) as { chat_id: string; body: string; updated_at: string }[]).map((r) => ({
    chatId: r.chat_id,
    body: r.body,
    updatedAt: r.updated_at,
  }));
}
