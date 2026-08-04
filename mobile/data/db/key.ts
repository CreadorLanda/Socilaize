import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { bytesToB64url } from '../crypto/encoding';

/**
 * The SQLCipher key for the local database.
 *
 * Generated once on first launch and kept in the OS keystore — Keychain on
 * iOS, EncryptedSharedPreferences on Android — never in the database file
 * itself and never sent anywhere.
 *
 * Losing this key makes the local history unreadable. That is the intended
 * trade: the device holds the only decrypted copy of a conversation, since
 * the server sweeps media after delivery and cannot read message bodies at
 * all. Restoring on a new device means re-syncing from the server, not
 * recovering this key.
 */

const DB_KEY = 'db.sqlcipher.key.v1';

let cached: string | null = null;

export async function getDatabaseKey(): Promise<string> {
  if (cached) return cached;

  const existing = await SecureStore.getItemAsync(DB_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }

  // 32 bytes of entropy. expo-crypto is used rather than tweetnacl so the
  // database can be opened even if the message-crypto layer fails to load.
  const key = bytesToB64url(Crypto.getRandomBytes(32));
  await SecureStore.setItemAsync(DB_KEY, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  cached = key;
  return key;
}

/**
 * Drop the key on logout. The database file is deleted alongside it — a
 * key-less encrypted file is dead weight, and leaving it invites confusion
 * about whether the data is still recoverable. It is not.
 */
export async function clearDatabaseKey(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(DB_KEY).catch(() => {});
}
