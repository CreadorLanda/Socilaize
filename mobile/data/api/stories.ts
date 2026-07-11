import { api } from './client';
import { mediaFileURL } from './media';

export type StoryKind = 'image' | 'video' | 'text' | 'audio';
export type StoryVisibility = 'public' | 'contacts' | 'close';

export interface StoryDTO {
  id: string;
  author_id: string;
  author_name?: string;
  author_username?: string;
  author_avatar?: string;
  kind: StoryKind;
  caption: string;
  media_url?: string;
  accent: string;
  visibility: StoryVisibility;
  is_anonymous: boolean;
  duration_sec: number;
  expires_at: string;
  created_at: string;
  viewers: number;
  is_viewed: boolean;
  is_own: boolean;
}

export function listStories() {
  return api.get<StoryDTO[]>('/api/stories');
}

export function getStory(id: string) {
  return api.get<StoryDTO>(`/api/stories/${id}`);
}

export function createStory(body: {
  kind: StoryKind;
  caption?: string;
  media_url?: string;
  accent?: string;
  visibility?: StoryVisibility;
  is_anonymous?: boolean;
  duration_sec?: number;
  ttl_hours?: number;
}) {
  return api.post<StoryDTO>('/api/stories', body);
}

export function viewStory(id: string) {
  return api.post<StoryDTO>(`/api/stories/${id}/view`);
}

export function reactStory(id: string, emoji: string) {
  return api.post<void>(`/api/stories/${id}/react`, { emoji });
}

export function deleteStory(id: string) {
  return api.del<void>(`/api/stories/${id}`);
}

/** Map API story → UI Story shape used by tabs/stories. */
export function mapStoryDTO(s: StoryDTO): import('@/data/mock').Story {
  const cover =
    s.media_url && (s.kind === 'image' || s.kind === 'video')
      ? mediaFileURL(s.media_url)
      : s.media_url
        ? mediaFileURL(s.media_url)
        : `https://picsum.photos/seed/${s.id}/900/1400`;
  const leftMs = new Date(s.expires_at).getTime() - Date.now();
  const leftH = Math.max(0, Math.round(leftMs / 3600000));
  return {
    id: s.id,
    user: s.is_own ? 'You' : s.author_name || 'Someone',
    username: s.author_username ? `@${s.author_username.replace(/^@/, '')}` : '',
    avatarUri: s.author_avatar || '',
    coverUri: cover,
    kind: s.kind,
    caption: s.caption,
    postedAt: relativeTime(s.created_at),
    expiresIn: leftH > 0 ? `${leftH}h left` : 'expiring',
    durationSec: s.duration_sec || 5,
    accent: s.accent || '#2D5BFF',
    viewers: s.viewers,
    replies: 0,
    isViewed: s.is_viewed,
    isOwn: s.is_own,
    visibility: s.visibility,
    isAnonymous: s.is_anonymous,
    allowComments: true,
  };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
