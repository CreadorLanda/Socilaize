import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/**
 * Device-local, per-chat preferences.
 *
 * These are deliberately NOT server settings — unlike pin / mute / archive
 * (see [chat-store]), a chat lock and media visibility describe this
 * device, not the account. Syncing them would leak which chats a user
 * considers sensitive to every other device and to the server.
 *
 * They used to be plain `useState` in chat-info, which meant every toggle
 * reset the moment you left the screen.
 */

const STORAGE_KEY = 'chat.prefs.v1';

export type ChatPrefs = {
  /** Hide this chat's preview text in the list. */
  locked: boolean;
  /** Show media from this chat in the chat-info gallery. */
  filesVisible: boolean;
};

const DEFAULTS: ChatPrefs = { locked: false, filesVisible: true };

let prefs: Record<string, ChatPrefs> = {};
let booted = false;
const listeners = new Set<() => void>();

function emit() {
  prefs = { ...prefs };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Load once at startup. Corrupt storage falls back to defaults, never throws. */
export async function bootstrapChatPrefs(): Promise<void> {
  if (booted) return;
  booted = true;
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      prefs = parsed as Record<string, ChatPrefs>;
      emit();
    }
  } catch {
    /* unreadable or malformed — start clean rather than block the app */
  }
}

async function persist() {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* keep the in-memory value; the toggle still works this session */
  }
}

export function getChatPrefs(chatId: string): ChatPrefs {
  return { ...DEFAULTS, ...(prefs[chatId] ?? {}) };
}

export function setChatPref<K extends keyof ChatPrefs>(
  chatId: string,
  key: K,
  value: ChatPrefs[K],
): void {
  prefs[chatId] = { ...getChatPrefs(chatId), [key]: value };
  emit();
  void persist();
}

/** Drop a chat's prefs when the chat itself is deleted. */
export function forgetChatPrefs(chatId: string): void {
  if (!prefs[chatId]) return;
  delete prefs[chatId];
  emit();
  void persist();
}

export function useChatPrefs(chatId: string | undefined): ChatPrefs {
  const all = useSyncExternalStore(
    subscribe,
    () => prefs,
    () => prefs,
  );
  return chatId ? { ...DEFAULTS, ...(all[chatId] ?? {}) } : DEFAULTS;
}

/** Locked chats hide their preview in the list. */
export function useLockedChatIds(): Set<string> {
  const all = useSyncExternalStore(
    subscribe,
    () => prefs,
    () => prefs,
  );
  return new Set(Object.keys(all).filter((id) => all[id]?.locked));
}

/**
 * Drop the in-memory prefs on sign-out.
 *
 * The persisted copy stays: these describe chats, and the same chat can be
 * returned to. Clearing the cache forces a reload so one account never reads
 * the map another account left in memory.
 */
export function resetChatPrefsCache(): void {
  prefs = {};
  booted = false;
  emit();
}
