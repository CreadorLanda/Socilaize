import { useSyncExternalStore } from 'react';

import {
  getStory,
  listStories,
  mapStoryDTO,
  type StoryDTO,
} from '@/data/api/stories';
import type { Story } from '@/data/mock';

/**
 * Stories feed — backend only. No mock seed.
 */

let feed: Story[] = [];
let booted = false;
let loading = false;
let lastError: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Load feed from API. Replaces local feed (empty when offline / no stories). */
export async function bootstrapStories(force = false): Promise<void> {
  if (loading) return;
  if (booted && !force) return;
  loading = true;
  lastError = null;
  emit();
  try {
    const list = await listStories();
    feed = (list ?? []).map(mapStoryDTO);
    booted = true;
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'stories_load_failed';
    // Keep previous feed if we already had data; otherwise stay empty.
    booted = true;
  } finally {
    loading = false;
    emit();
  }
}

/** Force refresh (pull-to-refresh / after publish). */
export async function refreshStories(): Promise<void> {
  booted = false;
  await bootstrapStories(true);
}

export function useStories(): Story[] {
  return useSyncExternalStore(subscribe, () => feed);
}

export function useStoriesLoading(): boolean {
  return useSyncExternalStore(subscribe, () => loading);
}

export function useStoriesError(): string | null {
  return useSyncExternalStore(subscribe, () => lastError);
}

export function getStoriesLocal(): Story[] {
  return feed;
}

export function getStoryLocal(id: string): Story | undefined {
  return feed.find((s) => s.id === id);
}

/** Fetch one story if missing from feed (deep link / viewer). */
export async function ensureStory(id: string): Promise<Story | undefined> {
  const local = getStoryLocal(id);
  if (local) return local;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  try {
    const dto = await getStory(id);
    const s = mapStoryDTO(dto);
    feed = [s, ...feed.filter((x) => x.id !== s.id)];
    emit();
    return s;
  } catch {
    return undefined;
  }
}

export function prependStoryFromDTO(dto: StoryDTO) {
  const s = mapStoryDTO(dto);
  feed = [s, ...feed.filter((x) => x.id !== s.id)];
  emit();
}

export function markStoryViewedLocal(id: string) {
  feed = feed.map((s) => (s.id === id ? { ...s, isViewed: true } : s));
  emit();
}

export function removeStoryLocal(id: string) {
  feed = feed.filter((s) => s.id !== id);
  emit();
}

export function storiesBooted() {
  return booted;
}
