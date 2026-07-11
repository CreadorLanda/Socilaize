import { api } from './client';

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
}

export interface SessionInitResponse {
  session_id: string;
  created: boolean;
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
