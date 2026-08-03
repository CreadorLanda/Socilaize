import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { useSyncExternalStore } from 'react';

import '@/data/crypto/prng';
import { b64urlToBytes, bytesToB64url, utf8Encode } from '@/data/crypto/encoding';

/**
 * The passcode that guards locked conversations.
 *
 * Locking used to be a boolean that dimmed the preview text: the row stayed
 * in the list, the chat opened on a tap, and every message was readable by
 * anyone holding the phone. It described a mood, not a protection.
 *
 * The code is never stored. What is stored is a salted hash, so reading the
 * keychain out of a stolen device yields nothing that can be replayed. It
 * cannot decrypt anything either — message content is already protected by
 * SQLCipher; this gates *reaching* a conversation, which is the threat a
 * locked chat is actually about (someone with your unlocked phone).
 */

const CODE_KEY = 'chat.lock.v1';
const MIN_LENGTH = 4;

type Stored = { salt: string; hash: string };

let cached: Stored | null | undefined;
const listeners = new Set<() => void>();

/**
 * Which locked chats are revealed for now.
 *
 * Deliberately in memory only: leaving the app must re-lock. Persisting this
 * would turn "unlock to look at one chat" into "unlocked until further
 * notice", which is not what anyone means by locking a conversation.
 */
let revealed = new Set<string>();

function emit() {
  revealed = new Set(revealed);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function hashWith(salt: Uint8Array, code: string): string {
  const codeBytes = utf8Encode(code);
  const buf = new Uint8Array(salt.length + codeBytes.length);
  buf.set(salt, 0);
  buf.set(codeBytes, salt.length);
  // Iterated so a four-digit code is not trivially brute-forced from the
  // stored hash alone. Not a KDF — but this guards a local UI gate, not key
  // material, and the alternative on hand was a single unsalted pass.
  let out = nacl.hash(buf);
  for (let i = 0; i < 2000; i++) out = nacl.hash(out);
  return bytesToB64url(out.slice(0, 32));
}

async function load(): Promise<Stored | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await SecureStore.getItemAsync(CODE_KEY);
    cached = raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Whether a passcode has been set on this device. */
export async function hasLockCode(): Promise<boolean> {
  return (await load()) !== null;
}

export function isValidCode(code: string): boolean {
  return code.trim().length >= MIN_LENGTH;
}

export const LOCK_CODE_MIN_LENGTH = MIN_LENGTH;

/**
 * Set the passcode. Refuses to overwrite an existing one without the old
 * code — otherwise anyone holding the phone could simply set a new one and
 * walk past every lock on it.
 */
export async function setLockCode(code: string, currentCode?: string): Promise<void> {
  if (!isValidCode(code)) throw new Error('code_too_short');
  const existing = await load();
  if (existing) {
    if (!currentCode || !(await verifyLockCode(currentCode))) {
      throw new Error('current_code_required');
    }
  }
  const salt = nacl.randomBytes(16);
  const stored: Stored = { salt: bytesToB64url(salt), hash: hashWith(salt, code) };
  await SecureStore.setItemAsync(CODE_KEY, JSON.stringify(stored), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  cached = stored;
}

export async function verifyLockCode(code: string): Promise<boolean> {
  const stored = await load();
  if (!stored) return false;
  return hashWith(b64urlToBytes(stored.salt), code) === stored.hash;
}

/**
 * Reveal locked chats for this session after a correct code.
 *
 * Returns false on a wrong code so callers can say so rather than silently
 * doing nothing.
 */
export async function unlockWithCode(code: string, chatIds?: string[]): Promise<boolean> {
  if (!(await verifyLockCode(code))) return false;
  if (chatIds) for (const id of chatIds) revealed.add(id);
  else revealed.add('*');
  emit();
  return true;
}

/** Drop every reveal — on backgrounding, and on sign-out. */
export function relockAll(): void {
  revealed = new Set();
  emit();
}

export function isRevealed(chatId: string): boolean {
  return revealed.has('*') || revealed.has(chatId);
}

export function useRevealedChats(): Set<string> {
  return useSyncExternalStore(
    subscribe,
    () => revealed,
    () => revealed,
  );
}

/** Forget the passcode entirely. Only safe once nothing is locked. */
export async function clearLockCode(): Promise<void> {
  cached = null;
  relockAll();
  await SecureStore.deleteItemAsync(CODE_KEY).catch(() => {});
}
