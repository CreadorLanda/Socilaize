import { decodeMediaContent, mediaFileURL } from '@/data/api/media';
import type { MessageDTO, ReactionDTO } from '@/data/api/messages';
import { decryptFromPeer, isEnvelope } from '@/data/crypto';
import type { MediaAttachment, Message } from '@/data/mock';

/** Map API message → UI Message used by the chat screen. */
export function mapApiMessage(m: MessageDTO, meId?: string | null): Message {
  const deleted = !!m.deleted_at;
  const base: Message = {
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
  if (deleted) return base;

  const mt = (m.message_type || 'text').toLowerCase();
  if (mt === 'image' || mt === 'video' || mt === 'audio') {
    const decoded = decodeMediaContent(m.content);
    if (decoded) {
      const media: MediaAttachment = {
        type: mt as 'image' | 'video' | 'audio',
        uri: mediaFileURL(decoded.url),
        durationSec:
          mt === 'audio' || mt === 'video'
            ? undefined
            : undefined,
      };
      return {
        ...base,
        text: decoded.caption,
        media,
      };
    }
  }
  // Client-E2EE envelope: keep ciphertext until async decrypt fills in.
  if (isEnvelope(m.content)) {
    return { ...base, text: '🔒 …' };
  }
  return base;
}

/**
 * Decrypt envelope content when possible. For outbound messages we decrypt
 * with the peer's session (same root key). Returns original text on failure.
 */
export async function decryptMessageContent(
  m: MessageDTO,
  meId?: string | null,
  peerUserId?: string | null,
): Promise<string> {
  if (!isEnvelope(m.content)) return m.content;
  const peer =
    peerUserId ||
    (meId && m.sender_id !== meId ? m.sender_id : null) ||
    (meId && m.sender_id === meId ? peerUserId : null);
  // For messages we sent, peer is the other party; for received, sender is peer.
  const sessionPeer =
    meId && m.sender_id === meId ? peerUserId ?? undefined : m.sender_id;
  if (!sessionPeer) return m.content;
  try {
    return await decryptFromPeer(sessionPeer, m.content);
  } catch {
    return '[encrypted]';
  }
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
