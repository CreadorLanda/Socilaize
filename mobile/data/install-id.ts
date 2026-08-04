import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const INSTALL_KEY = 'device.install.v1';

/**
 * A stable id for this installation of the app.
 *
 * The server had no way to recognise a returning phone: it minted a fresh
 * device row on every sign-in, and the client sent the constant string
 * "mobile" as its only identifying detail. One real handset ended up with 23
 * device rows, ten of them in a single day — each publishing its own pre-key
 * bundle, of which only the most recently seen is ever handed to a peer.
 *
 * Kept in SecureStore rather than the encrypted database for two reasons:
 * it is needed at sign-in, before there is a session to unlock the database
 * with, and it must outlive a sign-out. It identifies the installation, not
 * the account — signing in as someone else on the same phone is still the
 * same phone, and treating it as a new one is what created the pile of rows.
 *
 * Deliberately not derived from anything about the hardware. A value the
 * app generates can be thrown away by reinstalling; an advertising or
 * hardware id follows the person across apps they never connected.
 */
let cached: string | null = null;

export async function getInstallId(): Promise<string> {
  if (cached) return cached;

  const existing = await SecureStore.getItemAsync(INSTALL_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }

  const fresh = Crypto.randomUUID();
  await SecureStore.setItemAsync(INSTALL_KEY, fresh);
  // Cached only after the write: caching first would hand out an id that a
  // failed write means the next launch will not agree with, which is the
  // same bug that kept device keys from ever persisting.
  cached = fresh;
  return fresh;
}
