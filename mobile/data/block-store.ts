import { useSyncExternalStore } from 'react';

import { blockUser, listBlocks, unblockUser, type BlockedUser } from '@/data/api/blocks';

/**
 * Who you have blocked.
 *
 * Held in one place because two very different screens need it: the settings
 * list, which shows and lifts blocks, and any group screen, which has to tell
 * you that someone in the room is someone you blocked. Asking per member would
 * be one request per row.
 */

let blocked: BlockedUser[] = [];
let ids = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  ids = new Set(blocked.map((b) => b.user_id));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getBlocked(): BlockedUser[] {
  return blocked;
}

export function useBlocked(): BlockedUser[] {
  return useSyncExternalStore(subscribe, getBlocked, () => blocked);
}

/** Whether one person is blocked. Synchronous — a list row cannot await. */
export function isBlocked(userId: string | undefined | null): boolean {
  return !!userId && ids.has(userId);
}

/**
 * Which of these people you blocked.
 *
 * The group notice: you may share a room with someone you blocked, and being
 * told is the point of allowing it at all.
 */
export function blockedAmong(userIds: (string | undefined)[]): BlockedUser[] {
  const wanted = new Set(userIds.filter(Boolean) as string[]);
  return blocked.filter((b) => wanted.has(b.user_id));
}

export async function refreshBlocks(): Promise<void> {
  try {
    blocked = await listBlocks();
    emit();
  } catch {
    // A block list that fails to load is not worth a dialog. What it costs is
    // the group notice, and the enforcement is the server's either way.
  }
}

export async function block(userId: string): Promise<void> {
  await blockUser(userId);
  await refreshBlocks();
}

export async function unblock(userId: string): Promise<void> {
  await unblockUser(userId);
  await refreshBlocks();
}

/** Drop everything — called on logout so nothing outlives the account. */
export function resetBlocks(): void {
  blocked = [];
  emit();
}
