import { useSyncExternalStore } from 'react';

import {
  createList,
  deleteList,
  loadLists,
  renameList,
  setListMembership,
  type ChatList,
} from './db/lists';

/**
 * User-created chat filters — the chips above the chat list.
 *
 * Built-in filters (all/unread/read/groups) are not stored here, only the
 * ones the user makes. Those used to live in a module-level array and
 * nothing else, so every list vanished when the process died: creating one
 * looked like a feature and behaved like a scratchpad. They are now backed
 * by the encrypted database.
 *
 * The in-memory copy stays, as a synchronous cache — the list renders on
 * every keystroke of the filter bar and cannot wait on a query.
 */
export type CustomFilter = { id: string; name: string; chatIds: string[] };

let customFilters: CustomFilter[] = [];
let booted = false;
const listeners = new Set<() => void>();

function emit() {
  customFilters = [...customFilters];
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const toFilter = (l: ChatList): CustomFilter => ({
  id: l.id,
  name: l.name,
  chatIds: l.chatIds,
});

/** Load once at startup. Safe to call repeatedly. */
export async function bootstrapFilters(): Promise<void> {
  if (booted) return;
  booted = true;
  try {
    customFilters = (await loadLists()).map(toFilter);
    emit();
  } catch {
    // A build without SQLCipher, or a first run before the database exists.
    // An empty chip row is the right degradation: the chat list still works.
  }
}

async function reload(): Promise<void> {
  try {
    customFilters = (await loadLists()).map(toFilter);
    emit();
  } catch {
    /* keep what we have */
  }
}

export async function addCustomFilter(name: string, chatIds: string[]): Promise<string> {
  const id = await createList(name, chatIds);
  await reload();
  return id;
}

export async function removeCustomFilter(id: string): Promise<void> {
  await deleteList(id);
  await reload();
}

export async function renameCustomFilter(id: string, name: string): Promise<void> {
  await renameList(id, name);
  await reload();
}

/** Add or remove one chat from one list. */
export async function setFilterMembership(
  listId: string,
  chatId: string,
  member: boolean,
): Promise<void> {
  await setListMembership(listId, chatId, member);
  await reload();
}

export function useCustomFilters(): CustomFilter[] {
  return useSyncExternalStore(subscribe, () => customFilters, () => customFilters);
}

/** Which lists a chat is in, without a query — reads the cache. */
export function listsContaining(chatId: string): string[] {
  return customFilters.filter((f) => f.chatIds.includes(chatId)).map((f) => f.id);
}

/** Logout hook: the lists live in the wiped database, so drop the cache too. */
export function resetFilterStore(): void {
  customFilters = [];
  booted = false;
  emit();
}
