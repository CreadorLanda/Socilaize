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

export const waSendMessage = (jid: string, text: string) =>
  api.post<WaMessage>('/api/bridges/whatsapp/messages', { jid, text });

/** Encode WA chat id for expo-router paths. */
export function waChatRouteId(jid: string): string {
  return `wa:${jid}`;
}

export function parseWaChatId(id: string): string | null {
  if (id.startsWith('wa:')) return id.slice(3);
  if (id.includes('@s.whatsapp.net') || id.includes('@g.us')) return id;
  return null;
}
