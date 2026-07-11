import type { MessageDTO, ReactionDTO } from '@/data/api/messages';
import type { Message } from '@/data/mock';

/** Map API message → UI Message used by the chat screen. */
export function mapApiMessage(m: MessageDTO, meId?: string | null): Message {
  const deleted = !!m.deleted_at;
  return {
    id: String(m.id),
    text: deleted ? '' : m.content,
    fromMe: !!meId && m.sender_id === meId,
    timestamp: formatMsgTime(m.created_at),
    senderName: m.sender_name,
    senderAvatarUri: m.sender_avatar,
    edited: !!m.edited_at,
    deletedAt: m.deleted_at,
    status: m.read_by && m.read_by > 0 ? 'read' : m.delivered_to && m.delivered_to > 0 ? 'delivered' : 'sent',
    source: 'native',
  };
}

export function formatMsgTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Collapse reaction rows into the UI shape { emoji, count, mine }. */
export function collapseReactions(
  rows: ReactionDTO[],
  meId?: string | null,
): { emoji: string; count: number; mine: boolean }[] {
  const map = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const r of rows) {
    const cur = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    cur.count += 1;
    if (meId && r.user_id === meId) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return Array.from(map.values());
}

/** Numeric server id if the bubble id is an API id; null for optimistic temps. */
export function serverMessageId(id: string): number | null {
  if (!/^\d+$/.test(id)) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}
