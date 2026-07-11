import { useSyncExternalStore } from 'react';

import {
  CHANNELS as SEED_CHANNELS,
  type Channel,
  type ChannelCategory,
  type ChannelPost,
} from './mock';

/**
 * Client-side channel store (no backend yet).
 * Owns follow state, user-created channels, and permission settings.
 */

export type ChannelVisibility = 'public' | 'private';
export type PostPermission = 'admins' | 'publishers' | 'everyone';
export type JoinMode = 'open' | 'request' | 'invite';
export type SlowMode = 0 | 10 | 30 | 60 | 300;
export type ChannelRole = 'owner' | 'admin' | 'publisher' | 'member' | 'none';

export type ChannelSettings = {
  visibility: ChannelVisibility;
  whoCanPost: PostPermission;
  commentsEnabled: boolean;
  commentsRequireApproval: boolean;
  allowAnonymousComments: boolean;
  reactionsEnabled: boolean;
  slowModeSec: SlowMode;
  joinMode: JoinMode;
  showMemberList: boolean;
  showHistoryToNew: boolean;
};

export type ManagedChannel = Channel & {
  isOwned?: boolean;
  role?: ChannelRole;
  settings: ChannelSettings;
  createdAt?: string;
};

export type CreateChannelInput = {
  name: string;
  handle: string;
  description: string;
  category: Exclude<ChannelCategory, 'all'>;
  visibility: ChannelVisibility;
  whoCanPost: PostPermission;
  commentsEnabled: boolean;
  allowAnonymousComments: boolean;
  reactionsEnabled: boolean;
  joinMode: JoinMode;
};

const DEFAULT_SETTINGS: ChannelSettings = {
  visibility: 'public',
  whoCanPost: 'admins',
  commentsEnabled: true,
  commentsRequireApproval: true,
  allowAnonymousComments: true,
  reactionsEnabled: true,
  slowModeSec: 0,
  joinMode: 'open',
  showMemberList: true,
  showHistoryToNew: true,
};

function seedManaged(): ManagedChannel[] {
  return SEED_CHANNELS.map((c) => ({
    ...c,
    isOwned: false,
    role: 'none' as ChannelRole,
    settings: {
      ...DEFAULT_SETTINGS,
      // Official-ish channels: admins only
      whoCanPost: 'admins',
      visibility: 'public',
      joinMode: 'open',
    },
  }));
}

let channels: ManagedChannel[] = seedManaged();
let followed = new Set<string>(['ch1']);
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function normalizeHandle(raw: string) {
  const cleaned = raw
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
  return cleaned ? `@${cleaned}` : '';
}

// ── Follows ─────────────────────────────────────────────────────────────────

export function toggleFollow(id: string) {
  const next = new Set(followed);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  followed = next;
  emit();
}

export function useIsFollowing(id: string): boolean {
  return useSyncExternalStore(subscribe, () => followed.has(id));
}

export function useFollowedCount(): number {
  return useSyncExternalStore(subscribe, () => followed.size);
}

// ── Channels ────────────────────────────────────────────────────────────────

export function useChannels(): ManagedChannel[] {
  return useSyncExternalStore(subscribe, () => channels);
}

export function useChannel(id: string | undefined): ManagedChannel | undefined {
  return useSyncExternalStore(
    subscribe,
    () => channels.find((c) => c.id === id),
  );
}

export function getChannel(id: string): ManagedChannel | undefined {
  return channels.find((c) => c.id === id);
}

export function createChannel(input: CreateChannelInput): ManagedChannel {
  const handle = normalizeHandle(input.handle || input.name);
  const id = `ch_${Date.now().toString(36)}`;
  const seed = encodeURIComponent(input.name || id);

  const channel: ManagedChannel = {
    id,
    name: input.name.trim().slice(0, 60) || 'New channel',
    handle: handle || `@channel_${id.slice(-4)}`,
    avatarUri: `https://api.dicebear.com/9.x/shapes/png?seed=${seed}&backgroundColor=2D5BFF&size=200`,
    coverUri: `https://picsum.photos/seed/${seed}-cover/1200/800`,
    description: input.description.trim().slice(0, 500),
    category: input.category,
    members: 1,
    verified: false,
    rules: [],
    posts: [],
    isOwned: true,
    role: 'owner',
    createdAt: new Date().toISOString(),
    settings: {
      ...DEFAULT_SETTINGS,
      visibility: input.visibility,
      whoCanPost: input.whoCanPost,
      commentsEnabled: input.commentsEnabled,
      allowAnonymousComments: input.allowAnonymousComments,
      reactionsEnabled: input.reactionsEnabled,
      joinMode: input.joinMode,
    },
  };

  channels = [channel, ...channels];
  followed = new Set(followed).add(id);
  emit();
  return channel;
}

export function updateChannel(
  id: string,
  patch: Partial<
    Pick<ManagedChannel, 'name' | 'handle' | 'description' | 'category' | 'rules' | 'avatarUri' | 'coverUri'>
  >,
): ManagedChannel | undefined {
  let updated: ManagedChannel | undefined;
  channels = channels.map((c) => {
    if (c.id !== id) return c;
    updated = {
      ...c,
      ...patch,
      handle: patch.handle !== undefined ? normalizeHandle(patch.handle) || c.handle : c.handle,
      name: patch.name !== undefined ? patch.name.trim().slice(0, 60) : c.name,
      description:
        patch.description !== undefined ? patch.description.trim().slice(0, 500) : c.description,
    };
    return updated;
  });
  emit();
  return updated;
}

export function updateChannelSettings(
  id: string,
  patch: Partial<ChannelSettings>,
): ManagedChannel | undefined {
  let updated: ManagedChannel | undefined;
  channels = channels.map((c) => {
    if (c.id !== id) return c;
    updated = { ...c, settings: { ...c.settings, ...patch } };
    return updated;
  });
  emit();
  return updated;
}

export function canPublish(channel: ManagedChannel | undefined): boolean {
  if (!channel) return false;
  if (channel.role === 'owner' || channel.role === 'admin') return true;
  if (channel.settings.whoCanPost === 'everyone' && followed.has(channel.id)) return true;
  if (channel.settings.whoCanPost === 'publishers' && channel.role === 'publisher') return true;
  return !!channel.isOwned;
}

export function canManage(channel: ManagedChannel | undefined): boolean {
  if (!channel) return false;
  return channel.isOwned || channel.role === 'owner' || channel.role === 'admin';
}

export type AddPostInput = {
  text: string;
  type?: ChannelPost['type'];
  mediaUri?: string;
  gameKind?: ChannelPost['gameKind'];
  isLive?: boolean;
  liveViewers?: number;
};

export function addChannelPost(
  channelId: string,
  textOrInput: string | AddPostInput,
): ChannelPost | undefined {
  const channel = channels.find((c) => c.id === channelId);
  if (!channel || !canPublish(channel)) return undefined;

  const input: AddPostInput =
    typeof textOrInput === 'string' ? { text: textOrInput } : textOrInput;

  const post: ChannelPost = {
    id: `p_${Date.now().toString(36)}`,
    text: input.text.trim(),
    timestamp: 'now',
    views: 1,
    reactions: [],
    comments: [],
    type: input.type ?? (input.mediaUri ? 'image' : 'text'),
    mediaUri: input.mediaUri,
    gameKind: input.gameKind,
    isLive: input.isLive,
    liveViewers: input.liveViewers,
  };

  channels = channels.map((c) =>
    c.id === channelId ? { ...c, posts: [post, ...c.posts] } : c,
  );
  emit();
  return post;
}

export function isHandleAvailable(handle: string, exceptId?: string): boolean {
  const h = normalizeHandle(handle);
  if (!h || h.length < 3) return false;
  return !channels.some((c) => c.handle === h && c.id !== exceptId);
}

export { normalizeHandle };
