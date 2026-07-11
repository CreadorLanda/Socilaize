import { useSyncExternalStore } from 'react';

import { listStories, mapStoryDTO, type StoryDTO } from '@/data/api/stories';
import { STORIES, type Story } from '@/data/mock';

/**
 * Stories feed store — API first, mock fallback.
 */

let feed: Story[] = [...STORIES];
let booted = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export async function bootstrapStories(): Promise<void> {
  try {
    const list = await listStories();
    if (list && list.length > 0) {
      feed = list.map(mapStoryDTO);
      // Ensure "You" create card if no own story from API.
      if (!feed.some((s) => s.isOwn)) {
        const me = STORIES.find((s) => s.isOwn);
        if (me) feed = [me, ...feed];
      }
      booted = true;
      emit();
      return;
    }
  } catch {
    /* keep mock */
  }
  booted = true;
  emit();
}

export function useStories(): Story[] {
  return useSyncExternalStore(subscribe, () => feed);
}

export function getStoriesLocal(): Story[] {
  return feed;
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

export function storiesBooted() {
  return booted;
}
