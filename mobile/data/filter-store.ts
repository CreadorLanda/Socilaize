import { useSyncExternalStore } from 'react';

/**
 * User-created chat filters. Each filter is a named list of chat IDs, shown as
 * a chip above the chat list. Built-in filters (all/unread/read/groups) are not
 * stored here — only the custom ones the user creates.
 */
export type CustomFilter = { id: string; name: string; chatIds: string[] };

let customFilters: CustomFilter[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addCustomFilter(name: string, chatIds: string[]): string {
  const id = `f${Date.now()}`;
  customFilters = [...customFilters, { id, name, chatIds }];
  emit();
  return id;
}

export function removeCustomFilter(id: string) {
  customFilters = customFilters.filter((f) => f.id !== id);
  emit();
}

export function useCustomFilters(): CustomFilter[] {
  return useSyncExternalStore(subscribe, () => customFilters);
}
