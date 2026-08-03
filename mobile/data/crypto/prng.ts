import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';

/**
 * Give tweetnacl a secure random source.
 *
 * tweetnacl looks for `crypto.getRandomValues` (browser) or Node's crypto
 * module. React Native has neither, so every call that needs randomness —
 * `nacl.box.keyPair()`, `nacl.randomBytes()` — throws "no PRNG".
 *
 * That failure was invisible: key publication and message encryption both
 * caught the error and fell back to plaintext, so nothing looked broken
 * while none of the end-to-end encryption was actually running. The
 * database showed it plainly — zero identity keys, zero encrypted
 * envelopes, on an app whose whole point is E2E.
 *
 * Importing this module wires it up. It is imported from the crypto
 * barrel, so anything touching crypto gets it before first use.
 */

let installed = false;

export function installPRNG(): void {
  if (installed) return;
  nacl.setPRNG((x, n) => {
    const bytes = Crypto.getRandomBytes(n);
    for (let i = 0; i < n; i++) x[i] = bytes[i];
  });
  installed = true;
}

/**
 * Throws if randomness is unavailable, so callers can fail loudly instead
 * of silently producing weak or no encryption.
 */
export function assertPRNG(): void {
  installPRNG();
  const probe = nacl.randomBytes(8);
  if (probe.length !== 8 || probe.every((b) => b === 0)) {
    throw new Error('crypto_prng_unavailable');
  }
}

installPRNG();
