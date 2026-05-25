import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { authLogout } from './api/auth';
import type { ApiUser, Tokens } from './api/auth';
import { ACCESS_KEY, REFRESH_KEY } from './api/client';

/**
 * Authenticated-session store, persisted to the OS keychain via
 * expo-secure-store. The API client reads the tokens directly from
 * SecureStore; this module owns the *user* cache + reactive hook so
 * screens can re-render when sign-in / sign-out happens.
 */

const USER_KEY = 'auth.user';

let cachedUser: ApiUser | null = null;
let booted = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// One-time load at app startup so screens that mount before bootstrap
// finishes don't flash a logged-out view. Safe to call multiple times.
export async function bootstrapAuth(): Promise<ApiUser | null> {
  if (booted) return cachedUser;
  booted = true;
  const json = await SecureStore.getItemAsync(USER_KEY);
  if (!json) return null;
  try {
    cachedUser = JSON.parse(json) as ApiUser;
    emit();
    return cachedUser;
  } catch {
    return null;
  }
}

export async function setSession(user: ApiUser, tokens: Tokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.access_token),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
  cachedUser = user;
  emit();
}

export async function setUser(user: ApiUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  cachedUser = user;
  emit();
}

export async function clearSession(): Promise<void> {
  // Best-effort server-side revocation BEFORE we wipe the token locally.
  // If the network is gone, we still proceed — the local wipe is what the
  // user expects from "logout". The family-tracking on the server means a
  // stale token won't be reusable for long anyway.
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  if (refresh) {
    try {
      await authLogout(refresh);
    } catch {
      /* network down / server unreachable — proceed with the local wipe */
    }
  }
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
  cachedUser = null;
  emit();
}

/** Reactive — re-renders subscribers when the user changes. */
export function useCurrentUser(): ApiUser | null {
  return useSyncExternalStore(subscribe, () => cachedUser);
}

/** Non-reactive sync read, for cases where you only need the current value. */
export function getCurrentUser(): ApiUser | null {
  return cachedUser;
}
