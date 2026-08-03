import { getDB } from './index';

/**
 * Named lists of chats, backed by the encrypted database.
 *
 * The chips above the chat list already worked, but the store behind them
 * held everything in a module-level array — so a list survived exactly as
 * long as the process did. Building one felt like a feature and behaved
 * like a scratchpad.
 */

export type ChatList = {
  id: string;
  name: string;
  chatIds: string[];
  createdAt: string;
};

export async function loadLists(): Promise<ChatList[]> {
  const db = await getDB();
  const res = await db.execute(
    `SELECT l.id, l.name, l.created_at,
            (SELECT group_concat(m.chat_id) FROM chat_list_members m WHERE m.list_id = l.id) AS members
       FROM chat_lists l
      ORDER BY l.created_at ASC`,
  );
  return ((res.rows ?? []) as {
    id: string;
    name: string;
    created_at: string;
    members: string | null;
  }[]).map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    chatIds: r.members ? r.members.split(',') : [],
  }));
}

export async function createList(name: string, chatIds: string[] = []): Promise<string> {
  const db = await getDB();
  const id = `l${Date.now().toString(36)}`;
  await db.transaction(async (tx) => {
    await tx.execute('INSERT INTO chat_lists (id, name, created_at) VALUES (?, ?, ?)', [
      id,
      name.trim(),
      new Date().toISOString(),
    ]);
    for (const chatId of chatIds) {
      await tx.execute(
        'INSERT INTO chat_list_members (list_id, chat_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
        [id, chatId],
      );
    }
  });
  return id;
}

export async function renameList(id: string, name: string): Promise<void> {
  const db = await getDB();
  await db.execute('UPDATE chat_lists SET name = ? WHERE id = ?', [name.trim(), id]);
}

export async function deleteList(id: string): Promise<void> {
  const db = await getDB();
  // Members go with it: the foreign key cascades, but SQLite only enforces
  // that when the pragma is on, so do it explicitly rather than rely on it.
  await db.transaction(async (tx) => {
    await tx.execute('DELETE FROM chat_list_members WHERE list_id = ?', [id]);
    await tx.execute('DELETE FROM chat_lists WHERE id = ?', [id]);
  });
}

export async function setListMembership(
  listId: string,
  chatId: string,
  member: boolean,
): Promise<void> {
  const db = await getDB();
  if (member) {
    await db.execute(
      'INSERT INTO chat_list_members (list_id, chat_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
      [listId, chatId],
    );
  } else {
    await db.execute('DELETE FROM chat_list_members WHERE list_id = ? AND chat_id = ?', [
      listId,
      chatId,
    ]);
  }
}

/** Lists a given chat belongs to — for the badge on the details screen. */
export async function listsForChat(chatId: string): Promise<string[]> {
  const db = await getDB();
  const res = await db.execute('SELECT list_id FROM chat_list_members WHERE chat_id = ?', [chatId]);
  return ((res.rows ?? []) as { list_id: string }[]).map((r) => r.list_id);
}
