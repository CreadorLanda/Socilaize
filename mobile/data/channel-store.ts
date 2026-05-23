import { useSyncExternalStore } from 'react';

/**
 * Tracks which Discover channels the user follows. Shared between the Discover
 * list and the channel detail screen, with no backend.
 */
let followed = new Set<string>(['ch1']);
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleFollow(id: string) {
  const next = new Set(followed);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  followed = next;
  listeners.forEach((l) => l());
}

export function useIsFollowing(id: string): boolean {
  return useSyncExternalStore(subscribe, () => followed.has(id));
}

export function useFollowedCount(): number {
  return useSyncExternalStore(subscribe, () => followed.size);
}
