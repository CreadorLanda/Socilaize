import * as SecureStore from 'expo-secure-store';

import { ACCESS_KEY, api, BASE_URL } from './client';

export type ChatStatus = 'active' | 'pending' | 'blocked';

export interface ChatDTO {
  id: string;
  type: 'direct' | 'group';
  title?: string;
  avatar_url?: string;
  created_by: string;
  status?: ChatStatus;
  created_at: string;
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
  };
  unread_count: number;
}

export interface MessageDTO {
  id: number;
  chat_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  reply_to_id?: number;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  sender_name?: string;
  sender_avatar?: string;
  delivered_to?: number;
  read_by?: number;
}

export interface SessionInitResponse {
  session_id: string;
  created: boolean;
}

export type ReceiptStatus = 'delivered' | 'read';

export interface ReactionDTO {
  message_id: number;
  user_id: string;
  emoji: string;
  created_at: string;
}

/** Realtime event envelope from GET /api/ws */
export interface RealtimeEvent {
  type: string;
  chat_id?: string;
  payload?: unknown;
}

/** Initialize an E2EE session with a peer */
export function initSession(peerUsername: string) {
  return api.post<SessionInitResponse>('/api/sessions/init', {
    peer_username: peerUsername,
    device_id: 'default',
  });
}

/** Create a direct chat with a user */
export function createChat(peerUserId: string) {
  return api.post<{ chat_id: string; chat: ChatDTO }>('/api/chats', {
    peer_user_id: peerUserId,
  });
}

/** List all chats for the current user */
export function listChats() {
  return api.get<ChatDTO[]>('/api/chats');
}

/** Send a message in a chat */
export function sendMessage(
  chatId: string,
  content: string,
  messageType?: string,
  replyToId?: number,
) {
  return api.post<MessageDTO>(`/api/chats/${chatId}/messages`, {
    content,
    message_type: messageType ?? 'text',
    reply_to_id: replyToId,
  });
}

/** Edit own message */
export function editMessage(chatId: string, messageId: number, content: string) {
  return api.patch<MessageDTO>(`/api/chats/${chatId}/messages/${messageId}`, { content });
}

/** Soft-delete own message */
export function deleteMessage(chatId: string, messageId: number) {
  return api.del<MessageDTO>(`/api/chats/${chatId}/messages/${messageId}`);
}

/** Batch delivered/read receipts */
export function postReceipts(
  chatId: string,
  messageIds: number[],
  status: ReceiptStatus,
) {
  return api.post<void>(`/api/chats/${chatId}/receipts`, {
    message_ids: messageIds,
    status,
  });
}

/** Mark chat read up to message id */
export function markRead(chatId: string, messageId: number) {
  return api.post<void>(`/api/chats/${chatId}/read`, { message_id: messageId });
}

/** Broadcast typing indicator */
export function setTyping(chatId: string, typing: boolean) {
  return api.post<void>(`/api/chats/${chatId}/typing`, { typing });
}

/** Add reaction */
export function addReaction(chatId: string, messageId: number, emoji: string) {
  return api.post<ReactionDTO[]>(`/api/chats/${chatId}/messages/${messageId}/reactions`, {
    emoji,
  });
}

/** Remove reaction */
export function removeReaction(chatId: string, messageId: number, emoji: string) {
  return api.del<ReactionDTO[]>(
    `/api/chats/${chatId}/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`,
  );
}

/** Accept a pending friend request chat */
export function acceptChat(chatId: string) {
  return api.post<ChatDTO>(`/api/chats/${chatId}/accept`);
}

/** Block/decline a chat */
export function blockChat(chatId: string) {
  return api.post<void>(`/api/chats/${chatId}/block`);
}

/** List messages in a chat (newest first, paginated) */
export function listMessages(chatId: string, limit = 50, before?: number) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', String(before));
  return api.get<MessageDTO[]>(`/api/chats/${chatId}/messages?${params}`);
}

/**
 * Open the realtime WebSocket using the stored access token.
 * Returns null if there is no session.
 */
export async function connectRealtime(
  onEvent: (ev: RealtimeEvent) => void,
  onClose?: () => void,
): Promise<WebSocket | null> {
  const token = await SecureStore.getItemAsync(ACCESS_KEY);
  if (!token) return null;
  return openRealtimeWithToken(token, onEvent, onClose);
}

export function openRealtimeWithToken(
  token: string,
  onEvent: (ev: RealtimeEvent) => void,
  onClose?: () => void,
): WebSocket {
  const base = BASE_URL.replace(/^http/, 'ws');
  const ws = new WebSocket(`${base}/api/ws?token=${encodeURIComponent(token)}`);
  ws.onmessage = (e) => {
    try {
      onEvent(JSON.parse(String(e.data)) as RealtimeEvent);
    } catch {
      /* ignore malformed */
    }
  };
  ws.onclose = () => onClose?.();
  return ws;
}
