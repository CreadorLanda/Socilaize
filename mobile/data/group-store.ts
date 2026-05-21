import { useSyncExternalStore } from 'react';

import { GROUPS, type GroupInfo } from './mock';

/**
 * Lightweight cross-screen store for group settings.
 *
 * The group settings modal and the chat screen live on separate routes, so
 * changes (history toggle, mode, limit) need to be shared without a backend.
 * This keeps a mutable copy of the mock GROUPS and notifies subscribers.
 */
let groups: Record<string, GroupInfo> = { ...GROUPS };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateGroup(id: string, patch: Partial<GroupInfo>) {
  const current = groups[id];
  if (!current) return;
  groups = { ...groups, [id]: { ...current, ...patch } };
  listeners.forEach((l) => l());
}

/** Subscribe a component to a group's settings. Returns `undefined` for non-groups. */
export function useGroup(id: string | undefined): GroupInfo | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (id ? groups[id] : undefined),
  );
}
