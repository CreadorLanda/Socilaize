import { api } from './client';

/**
 * WhatsApp bridge endpoints. The server embeds whatsmeow and talks to
 * WhatsApp Web servers directly — no Matrix sidecar in between.
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

export const waLink = (phone: string) =>
  api.post<LinkResponse>('/api/bridges/whatsapp/link', { phone });

export const waStatus = () =>
  api.get<StatusResponse>('/api/bridges/whatsapp/status');

export const waUnlink = () =>
  api.del<void>('/api/bridges/whatsapp/link');
