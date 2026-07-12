import type { MediaAttachment, MessageAttachment } from '@/data/mock';

import { api } from './client';

/**
 * WhatsApp bridge endpoints. The server embeds whatsmeow/Baileys sidecar.
 */

export type WaStatus = 'pending' | 'linked' | 'failed' | 'disconnected';

export type LinkResponse = {
  status: WaStatus;
  phone: string;
  pairing_code: string;
  pairing_expires_at: string;
};

export type StatusResponse = {
  status: WaStatus;
  phone?: string;
  jid?: string;
  pairing_code?: string;
  pairing_expires_at?: string;
  last_error?: string;
  linked_at?: string;
};

export type WaChatSummary = {
  chat_jid: string;
  last_content: string;
  last_type: string;
  last_at: string;
  is_group: boolean;
  message_count: number;
};

export type WaMessage = {
  id: number;
  user_id: string;
  wa_message_id: string;
  chat_jid: string;
  sender_jid: string;
  message_type: string;
  content: string;
  media_url?: string;
  wa_timestamp: number;
  created_at: string;
};

export const waLink = (phone: string) =>
  api.post<LinkResponse>('/api/bridges/whatsapp/link', { phone });

export const waStatus = () =>
  api.get<StatusResponse>('/api/bridges/whatsapp/status');

export const waUnlink = () =>
  api.del<void>('/api/bridges/whatsapp/link');

export const waListChats = () =>
  api.get<WaChatSummary[]>('/api/bridges/whatsapp/chats');

export const waListMessages = (jid: string) =>
  api.get<WaMessage[]>(
    `/api/bridges/whatsapp/messages?jid=${encodeURIComponent(jid)}`,
  );

export const waSendMessage = (
  jid: string,
  text: string,
  opts?: { type?: string; media_url?: string },
) =>
  api.post<WaMessage>('/api/bridges/whatsapp/messages', {
    jid,
    text,
    type: opts?.type ?? 'text',
    media_url: opts?.media_url,
  });

/** Map a stored WA message into UI-friendly media / attachment fields. */
export function mapWaMedia(
  m: WaMessage,
  resolveUrl: (path: string) => string,
): {
  media?: MediaAttachment;
  attachment?: MessageAttachment;
  text: string;
} {
  const text = m.content || '';
  const url = m.media_url ? resolveUrl(m.media_url) : '';
  switch (m.message_type) {
    case 'image':
      return { text, media: url ? { type: 'image', uri: url } : undefined };
    case 'video':
      return { text, media: url ? { type: 'video', uri: url } : undefined };
    case 'audio':
      return { text, media: url ? { type: 'audio', uri: url } : undefined };
    case 'sticker':
      return {
        text: '',
        attachment: url ? { kind: 'sticker', uri: url } : undefined,
      };
    case 'document':
      return {
        text,
        attachment: {
          kind: 'document',
          name: text || 'Document',
          ext: guessExt(m.media_url || text),
          sizeLabel: '—',
        },
      };
    case 'location': {
      const [lat, lng] = (text || '0,0').split(',');
      return {
        text: '',
        attachment: {
          kind: 'location',
          place: 'Location',
          address: `${lat}, ${lng}`,
        },
      };
    }
    case 'contact':
      return {
        text: '',
        attachment: { kind: 'contact', name: text || 'Contact', detail: '' },
      };
    default:
      return { text };
  }
}

function guessExt(s: string): string {
  const base = s.split('?')[0].split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot >= 0) return base.slice(dot + 1).slice(0, 8) || 'file';
  return 'file';
}

/** Encode WA chat id for expo-router paths. */
export function waChatRouteId(jid: string): string {
  return `wa:${jid}`;
}

export function parseWaChatId(id: string): string | null {
  if (id.startsWith('wa:')) return id.slice(3);
  if (id.includes('@s.whatsapp.net') || id.includes('@g.us')) return id;
  return null;
}
