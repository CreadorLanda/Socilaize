import { api } from './client';
import { mediaFileURL } from './media';
import type {
  ChannelCategory,
  ChannelComment,
  ChannelPost,
  ChannelReaction,
} from '@/data/mock';
import type {
  ChannelRole,
  ChannelSettings,
  ChannelVisibility,
  JoinMode,
  ManagedChannel,
  PostPermission,
} from '@/data/channel-store';

export interface ChannelDTO {
  id: string;
  owner_id: string;
  name: string;
  handle: string;
  description: string;
  category: string;
  avatar_url?: string;
  cover_url?: string;
  visibility: ChannelVisibility;
  who_can_post: PostPermission;
  comments_enabled: boolean;
  allow_anon_comments: boolean;
  reactions_enabled: boolean;
  join_mode: JoinMode;
  verified: boolean;
  members: number;
  following: boolean;
  role: ChannelRole | 'none';
  created_at: string;
  posts?: ChannelPostDTO[];
}

export interface ChannelPostDTO {
  id: string;
  channel_id: string;
  author_id: string;
  text: string;
  post_type: string;
  media_url?: string;
  views: number;
  created_at: string;
  my_emoji?: string;
  reactions?: { emoji: string; count: number }[];
}

export interface ChannelCommentDTO {
  id: string;
  post_id: string;
  author_id?: string;
  author_name?: string;
  text: string;
  anonymous: boolean;
  created_at: string;
}

export function listChannels(category?: string) {
  const q = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
  return api.get<ChannelDTO[]>(`/api/channels${q}`);
}

export function getChannel(id: string) {
  return api.get<ChannelDTO>(`/api/channels/${id}`);
}

export function createChannelApi(body: {
  name: string;
  handle: string;
  description?: string;
  category?: string;
  avatar_url?: string;
  cover_url?: string;
  visibility?: ChannelVisibility;
  who_can_post?: PostPermission;
  comments_enabled?: boolean;
  allow_anon_comments?: boolean;
  reactions_enabled?: boolean;
  join_mode?: JoinMode;
}) {
  return api.post<ChannelDTO>('/api/channels', {
    ...body,
    handle: body.handle.replace(/^@/, ''),
  });
}

export function patchChannel(id: string, patch: Record<string, unknown>) {
  return api.patch<ChannelDTO>(`/api/channels/${id}`, patch);
}

export function followChannel(id: string) {
  return api.post<ChannelDTO>(`/api/channels/${id}/follow`);
}

export function unfollowChannel(id: string) {
  return api.del<ChannelDTO>(`/api/channels/${id}/follow`);
}

export function createChannelPost(
  channelId: string,
  body: { text?: string; post_type?: string; media_url?: string },
) {
  return api.post<ChannelPostDTO>(`/api/channels/${channelId}/posts`, body);
}

export function reactToPost(postId: string, emoji: string) {
  return api.post<void>(`/api/channel-posts/${postId}/react`, { emoji });
}

export function clearPostReaction(postId: string) {
  return api.del<void>(`/api/channel-posts/${postId}/react`);
}

export function listPostComments(postId: string) {
  return api.get<ChannelCommentDTO[]>(`/api/channel-posts/${postId}/comments`);
}

export function addPostComment(postId: string, text: string, anonymous?: boolean) {
  return api.post<ChannelCommentDTO>(`/api/channel-posts/${postId}/comments`, {
    text,
    anonymous: !!anonymous,
  });
}

export function checkHandleAvailable(handle: string) {
  return api.get<{ available: boolean }>(
    `/api/channels/handle-available?handle=${encodeURIComponent(handle.replace(/^@/, ''))}`,
  );
}

export function mapPostDTO(p: ChannelPostDTO): ChannelPost {
  const reactions: ChannelReaction[] = (p.reactions ?? []).map((r) => ({
    emoji: r.emoji,
    count: r.count,
  }));
  return {
    id: p.id,
    text: p.text,
    mediaUri: p.media_url ? mediaFileURL(p.media_url) : undefined,
    timestamp: relative(p.created_at),
    views: p.views,
    reactions,
    myReaction: p.my_emoji || null,
    type: (p.post_type as ChannelPost['type']) || 'text',
    comments: [],
  };
}

export function mapChannelDTO(c: ChannelDTO): ManagedChannel {
  const settings: ChannelSettings = {
    visibility: c.visibility || 'public',
    whoCanPost: c.who_can_post || 'admins',
    commentsEnabled: c.comments_enabled,
    commentsRequireApproval: false,
    allowAnonymousComments: c.allow_anon_comments,
    reactionsEnabled: c.reactions_enabled,
    slowModeSec: 0,
    joinMode: c.join_mode || 'open',
    showMemberList: true,
    showHistoryToNew: true,
  };
  const cat = (c.category || 'other') as Exclude<ChannelCategory, 'all'>;
  return {
    id: c.id,
    name: c.name,
    handle: c.handle.startsWith('@') ? c.handle : `@${c.handle}`,
    avatarUri: c.avatar_url || '',
    coverUri: c.cover_url || '',
    description: c.description || '',
    category: cat,
    members: c.members,
    verified: c.verified,
    rules: [],
    posts: (c.posts ?? []).map(mapPostDTO),
    isOwned: c.role === 'owner',
    role: c.role === 'none' ? 'none' : c.role,
    settings,
    createdAt: c.created_at,
  };
}

function relative(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
