import { useSyncExternalStore } from 'react';

import {
  createChannelApi,
  createChannelPost as apiCreatePost,
  followChannel as apiFollow,
  listChannels,
  mapChannelDTO,
  unfollowChannel as apiUnfollow,
  type ChannelDTO,
} from '@/data/api/channels';
import {
  CHANNELS as SEED_CHANNELS,
  type Channel,
  type ChannelCategory,
  type ChannelPost,
} from './mock';

/**
 * Channel store — seed mocks + live API merge.
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
let apiBooted = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Load public channels from API and merge (API wins on id collision). */
export async function bootstrapChannels(): Promise<void> {
  if (apiBooted) return;
  try {
    const list = await listChannels();
    if (!list?.length) {
      apiBooted = true;
      return;
    }
    const mapped = list.map(mapChannelDTO);
    const byId = new Map(channels.map((c) => [c.id, c]));
    for (const c of mapped) {
      byId.set(c.id, c);
    }
    channels = Array.from(byId.values());
    const nextFollow = new Set(followed);
    for (const c of mapped) {
      if (c.role !== 'none' && c.role) nextFollow.add(c.id);
      // DTO.following
    }
    // re-read following from DTO
    for (const raw of list) {
      if (raw.following) nextFollow.add(raw.id);
    }
    followed = nextFollow;
    apiBooted = true;
    emit();
  } catch {
    apiBooted = true;
  }
}

function mergeDTO(dto: ChannelDTO) {
  const mapped = mapChannelDTO(dto);
  const idx = channels.findIndex((c) => c.id === mapped.id);
  if (idx >= 0) {
    const next = [...channels];
    next[idx] = { ...next[idx], ...mapped, posts: mapped.posts.length ? mapped.posts : next[idx].posts };
    channels = next;
  } else {
    channels = [mapped, ...channels];
  }
  if (dto.following) {
    followed = new Set(followed).add(dto.id);
  } else {
    const n = new Set(followed);
    n.delete(dto.id);
    followed = n;
  }
  emit();
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
  const was = followed.has(id);
  const next = new Set(followed);
  if (was) next.delete(id);
  else next.add(id);
  followed = next;
  emit();
  // Persist when channel is a real UUID from API.
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    (was ? apiUnfollow(id) : apiFollow(id))
      .then(mergeDTO)
      .catch(() => {
        /* keep optimistic */
      });
  }
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

  // Fire-and-forget API create; replace local id when server responds.
  createChannelApi({
    name: channel.name,
    handle: channel.handle,
    description: channel.description,
    category: channel.category,
    visibility: input.visibility,
    who_can_post: input.whoCanPost,
    comments_enabled: input.commentsEnabled,
    allow_anon_comments: input.allowAnonymousComments,
    reactions_enabled: input.reactionsEnabled,
    join_mode: input.joinMode,
  })
    .then((dto) => {
      const mapped = mapChannelDTO(dto);
      channels = channels.filter((c) => c.id !== id);
      channels = [mapped, ...channels];
      followed = new Set(followed);
      followed.delete(id);
      followed.add(mapped.id);
      emit();
    })
    .catch(() => {
      /* keep local-only channel */
    });

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

  if (/^[0-9a-f-]{36}$/i.test(channelId)) {
    apiCreatePost(channelId, {
      text: post.text,
      post_type: post.type,
      media_url: post.mediaUri,
    })
      .then((dto) => {
        const mapped = {
          id: dto.id,
          text: dto.text,
          mediaUri: dto.media_url,
          timestamp: 'now',
          views: dto.views,
          type: (dto.post_type as ChannelPost['type']) || 'text',
          reactions: [],
          comments: [],
        } as ChannelPost;
        channels = channels.map((c) => {
          if (c.id !== channelId) return c;
          return {
            ...c,
            posts: [mapped, ...c.posts.filter((p) => p.id !== post.id)],
          };
        });
        emit();
      })
      .catch(() => {});
  }

  return post;
}

export function isHandleAvailable(handle: string, exceptId?: string): boolean {
  const h = normalizeHandle(handle);
  if (!h || h.length < 3) return false;
  return !channels.some((c) => c.handle === h && c.id !== exceptId);
}

export { normalizeHandle };
