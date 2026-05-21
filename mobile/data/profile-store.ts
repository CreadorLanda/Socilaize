import { useSyncExternalStore } from 'react';

import { CURRENT_USER, type UserProfile } from './mock';

/**
 * Cross-screen store for the current user's profile.
 *
 * The profile screen and its edit mode mutate this so changes survive
 * navigation without a backend.
 */
let profile: UserProfile = { ...CURRENT_USER };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateProfile(patch: Partial<UserProfile>) {
  profile = { ...profile, ...patch };
  listeners.forEach((l) => l());
}

export function useProfile(): UserProfile {
  return useSyncExternalStore(subscribe, () => profile);
}
