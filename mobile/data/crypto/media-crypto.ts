import nacl from 'tweetnacl';

// Installs the random source tweetnacl needs; without it every call here
// throws "no PRNG".
import './prng';

import { b64urlToBytes, bytesToB64url } from './encoding';

/**
 * Per-file encryption for media.
 *
 * Every upload gets a fresh random key. The ciphertext goes to the server;
 * the key travels inside the message, which is itself end-to-end encrypted
 * for the recipient. The server therefore stores bytes it cannot read, and
 * a leaked media UUID is worthless on its own.
 *
 * Same primitive as message bodies (XSalsa20-Poly1305 via nacl.secretbox),
 * so there is one authenticated-encryption construction in the app rather
 * than two to reason about.
 */

export type MediaKey = {
  /** base64url — 32 bytes */
  key: string;
  /** base64url — 24 bytes */
  nonce: string;
};

export function generateMediaKey(): MediaKey {
  return {
    key: bytesToB64url(nacl.randomBytes(nacl.secretbox.keyLength)),
    nonce: bytesToB64url(nacl.randomBytes(nacl.secretbox.nonceLength)),
  };
}

export function encryptMediaBytes(plain: Uint8Array, mk: MediaKey): Uint8Array {
  const boxed = nacl.secretbox(plain, b64urlToBytes(mk.nonce), b64urlToBytes(mk.key));
  if (!boxed) throw new Error('media_encrypt_failed');
  return boxed;
}

/** Returns null when the key is wrong or the bytes were tampered with. */
export function decryptMediaBytes(cipher: Uint8Array, mk: MediaKey): Uint8Array | null {
  try {
    return nacl.secretbox.open(cipher, b64urlToBytes(mk.nonce), b64urlToBytes(mk.key));
  } catch {
    return null;
  }
}

/** True when a decoded media payload carries a key, i.e. it is encrypted. */
export function hasMediaKey(v: { key?: string; nonce?: string } | null): v is MediaKey {
  return !!v?.key && !!v?.nonce;
}
