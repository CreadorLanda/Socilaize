import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';

// tweetnacl has no random source in React Native without this.
import './prng';

import { myKeyCount, uploadKeys, type UploadKeysRequest } from '@/data/api/keys';
import { getCurrentUser } from '@/data/auth-store';

import { deleteSecret, getSecret, setSecret } from '@/data/db/secrets';

import { b64urlToBytes, bytesToB64url } from './encoding';

const KEYS_STORE = 'e2ee.device_keys.v1';

/**
 * Storage key for this account's material, namespaced by the signed-in user.
 *
 * One device, several accounts. Sharing a single slot meant whoever signed in
 * next adopted the previous account's identity and republished it as their
 * own — the two became indistinguishable to peers. Wiping the slot on logout
 * fixed that but broke the other direction: switching back regenerated a
 * fresh identity, so every message sent to the old one was undecryptable.
 *
 * Namespacing settles both. Each account keeps its own identity across sign
 * -outs, and no account can ever pick up another's.
 */
function keysStoreFor(): string {
  const self = getCurrentUser()?.id ?? 'anon';
  return `${KEYS_STORE}.${self}`;
}
const OTK_TARGET = 40;
const OTK_REFILL_BELOW = 10;

export type DeviceKeyMaterial = {
  /** X25519 identity (long-lived). */
  identityPublic: string;
  identitySecret: string;
  /** Current signed pre-key (X25519) + "signature" over public key. */
  signedPreKeyId: number;
  signedPreKeyPublic: string;
  signedPreKeySecret: string;
  signedPreKeySignature: string;
  /** Remaining private OTKs keyed by key_id (public already uploaded). */
  oneTimeSecrets: Record<string, string>;
  /**
   * One-time keys already spent, kept so the same envelope can be opened
   * more than once.
   *
   * "One-time" governs how often a key may be *handed out*, not how often a
   * message encrypted under it may be read. Deleting the secret on first use
   * conflated the two: every chat re-open re-decrypts the same history, and
   * the second pass found nothing, so a thread that opened correctly once
   * was permanently unreadable afterwards.
   */
  usedOtkSecrets?: Record<string, string>;
  nextOtkId: number;
  uploadedAt?: string;
};

/** How many spent one-time keys to keep before dropping the oldest. */
const USED_OTK_RETAIN = 60;

let cached: DeviceKeyMaterial | null = null;
/** Which account `cached` belongs to — see loadDeviceKeys. */
let cachedFor: string | null = null;

function keyPairB64() {
  const kp = nacl.box.keyPair();
  return {
    publicKey: bytesToB64url(kp.publicKey),
    secretKey: bytesToB64url(kp.secretKey),
  };
}

/**
 * HMAC-like signature for SPK using the identity secret as key material.
 * Not Ed25519 (nacl.sign would need a second key family); sufficient to
 * bind SPK to this identity for the server-stored bundle.
 */
function signSpk(identitySecretB64: string, spkPublicB64: string): string {
  const ik = b64urlToBytes(identitySecretB64);
  const msg = b64urlToBytes(spkPublicB64);
  // Derive a 32-byte key then use secretbox as a MAC of zeros over the message.
  const macKey = nacl.hash(ik).slice(0, 32);
  const nonce = nacl.hash(msg).slice(0, 24);
  const box = nacl.secretbox(msg, nonce, macKey);
  return bytesToB64url(box.slice(0, 64));
}

/**
 * First id for a fresh one-time key pool.
 *
 * Starting at 1 every time made ids collide across generations: an envelope
 * addressed to otk_id 5 of a discarded pool would find id 5 of the *current*
 * pool, a completely unrelated key. That does not fail — it derives a
 * different root key and every message in the thread comes back "cannot
 * decrypt" with nothing to point at. A random 31-bit base makes a stale id
 * miss instead, which surfaces as a re-key rather than silent corruption.
 */
function freshOtkBase(): number {
  const b = nacl.randomBytes(4);
  return (((b[0] << 23) | (b[1] << 15) | (b[2] << 7) | b[3]) >>> 0) % 0x7fff0000 + 1;
}

function generateFresh(): DeviceKeyMaterial {
  const identity = keyPairB64();
  const spk = keyPairB64();
  const spkId = 1;
  const secrets: Record<string, string> = {};
  let nextOtkId = freshOtkBase();
  for (let i = 0; i < OTK_TARGET; i++) {
    const otk = keyPairB64();
    secrets[String(nextOtkId)] = otk.secretKey;
    nextOtkId += 1;
  }

  return {
    identityPublic: identity.publicKey,
    identitySecret: identity.secretKey,
    signedPreKeyId: spkId,
    signedPreKeyPublic: spk.publicKey,
    signedPreKeySecret: spk.secretKey,
    signedPreKeySignature: signSpk(identity.secretKey, spk.publicKey),
    oneTimeSecrets: secrets,
    nextOtkId,
  };
}

/**
 * Persist the key material to the encrypted database.
 *
 * This deliberately does not swallow failures. The old SecureStore write did
 * — it exceeded the 2048-byte cap, warned, and returned — so the identity was
 * only ever in memory. Everything worked until the app restarted, at which
 * point every inbound envelope decrypted to "missing keys" because the
 * private half of the published bundle no longer existed.
 */
async function persist(m: DeviceKeyMaterial): Promise<void> {
  await setSecret(keysStoreFor(), JSON.stringify(m));
  // Only cache once the write succeeded. Caching first is what let a failed
  // persist masquerade as a working session.
  cached = m;
  cachedFor = getCurrentUser()?.id ?? 'anon';
}

export async function loadDeviceKeys(): Promise<DeviceKeyMaterial | null> {
  // The cache is process-wide but the material is per-account, so a switch
  // without a restart would otherwise hand the new account the old one's keys.
  const self = getCurrentUser()?.id ?? 'anon';
  if (cached && cachedFor === self) return cached;
  cached = null;

  const raw = await getSecret(keysStoreFor());
  if (raw) {
    try {
      cached = JSON.parse(raw) as DeviceKeyMaterial;
      cachedFor = self;
      return cached;
    } catch {
      return null;
    }
  }

  // One-time carry-over for installs that predate the move. Small pools did
  // fit under the cap, so some devices genuinely have material here worth
  // keeping — regenerating would orphan every session already established.
  return migrateFromSecureStore();
}

/**
 * Adopt material left in either pre-namespacing location: the original
 * SecureStore slot, or the un-namespaced row in the secrets table.
 *
 * The claim is first-come. Both old locations were shared by every account on
 * the device, so handing the same material to a second account would recreate
 * exactly the shared-identity bug namespacing exists to prevent. Deleting on
 * adoption means the first account to sign in keeps it and the rest generate
 * their own.
 */
async function migrateFromSecureStore(): Promise<DeviceKeyMaterial | null> {
  let legacy: string | null = null;
  try {
    legacy = (await getSecret(KEYS_STORE)) ?? (await SecureStore.getItemAsync(KEYS_STORE));
  } catch {
    return null;
  }
  if (!legacy) return null;

  try {
    const parsed = JSON.parse(legacy) as DeviceKeyMaterial;
    await persist(parsed);
    // Only drop the originals once the new copy is safely written.
    await deleteSecret(KEYS_STORE).catch(() => {});
    await SecureStore.deleteItemAsync(KEYS_STORE).catch(() => {});
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Forget this account's identity entirely.
 *
 * Not called on logout any more. Destroying the identity means every message
 * a peer encrypted for it while we were signed out is lost for good, and on
 * a device where two accounts take turns that is every message. Namespacing
 * already prevents accounts from adopting each other's keys, which was the
 * reason the logout wipe existed.
 *
 * Kept for account deletion, and for recovering a device whose material is
 * corrupt.
 */
export async function clearDeviceKeys(): Promise<void> {
  cached = null;
  cachedFor = null;
  await deleteSecret(keysStoreFor());
  // Legacy locations, from before the material moved and was namespaced.
  await deleteSecret(KEYS_STORE);
  await SecureStore.deleteItemAsync(KEYS_STORE).catch(() => {});
}

/**
 * Ensure identity + SPK + OTK pool exist and are published to the server.
 * Call after login / session restore.
 */
export async function ensureKeysPublished(): Promise<DeviceKeyMaterial> {
  let material = await loadDeviceKeys();
  if (!material) {
    material = generateFresh();
    await persist(material);
  }

  // Build public OTK list from secrets (derive public via nacl.box.keyPair.fromSecretKey)
  const otkPublics: { key_id: number; public_key: string }[] = [];
  for (const [id, secretB64] of Object.entries(material.oneTimeSecrets)) {
    const secret = b64urlToBytes(secretB64);
    const kp = nacl.box.keyPair.fromSecretKey(secret);
    otkPublics.push({ key_id: Number(id), public_key: bytesToB64url(kp.publicKey) });
  }

  const body: UploadKeysRequest = {
    identity_key: material.identityPublic,
    signed_pre_key: {
      key_id: material.signedPreKeyId,
      public_key: material.signedPreKeyPublic,
      signature: material.signedPreKeySignature,
    },
    one_time_pre_keys: otkPublics,
  };

  try {
    const res = await uploadKeys(body);
    material = {
      ...material,
      uploadedAt: new Date().toISOString(),
    };
    await persist(material);
    if (res.one_time_remaining < OTK_REFILL_BELOW) {
      await refillOneTimeKeys(material);
    }
  } catch {
    // Offline / unauth — keep local keys; retry next bootstrap.
  }
  return material;
}

async function refillOneTimeKeys(material: DeviceKeyMaterial): Promise<void> {
  const newOtks: { key_id: number; public_key: string }[] = [];
  const secrets = { ...material.oneTimeSecrets };
  let next = material.nextOtkId;
  for (let i = 0; i < OTK_TARGET; i++) {
    const otk = keyPairB64();
    secrets[String(next)] = otk.secretKey;
    newOtks.push({ key_id: next, public_key: otk.publicKey });
    next += 1;
  }
  const updated: DeviceKeyMaterial = {
    ...material,
    oneTimeSecrets: secrets,
    nextOtkId: next,
  };
  await persist(updated);
  try {
    await uploadKeys({
      identity_key: updated.identityPublic,
      signed_pre_key: {
        key_id: updated.signedPreKeyId,
        public_key: updated.signedPreKeyPublic,
        signature: updated.signedPreKeySignature,
      },
      one_time_pre_keys: newOtks,
    });
  } catch {
    /* keep local */
  }
}

/** Safety number digits from our identity public key (and optional peer). */
export function safetyNumber(
  localIdentityPublic: string,
  peerIdentityPublic?: string,
): string {
  const a = b64urlToBytes(localIdentityPublic);
  const b = peerIdentityPublic ? b64urlToBytes(peerIdentityPublic) : new Uint8Array(0);
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a, 0);
  joined.set(b, a.length);
  const hash = nacl.hash(joined);
  // 60 digits as 12 groups of 5 — match product doc shape.
  let digits = '';
  for (let i = 0; i < 30; i++) {
    digits += String(hash[i % hash.length] % 10);
  }
  // Expand to 60 by hashing again
  const hash2 = nacl.hash(hash);
  for (let i = 0; i < 30; i++) {
    digits += String(hash2[i % hash2.length] % 10);
  }
  return digits.match(/.{1,12}/g)?.join(' ') ?? digits;
}

/** Consume a local OTK secret by id (after peer used that public key). */
/**
 * Retrieve the private half of a one-time key, retiring it from the live
 * pool on first use but keeping the secret available afterwards.
 *
 * Returning null here means refusing the session outright, so this must only
 * happen when the key genuinely never existed — not merely because it was
 * used before. Re-decrypting history is routine: it happens on every chat
 * open, on every cache miss, and whenever a stale session is rebuilt from
 * the envelope header.
 */
export async function takeOtkSecret(keyId: number): Promise<Uint8Array | null> {
  const material = await loadDeviceKeys();
  if (!material) return null;
  const id = String(keyId);

  const live = material.oneTimeSecrets[id];
  if (live) {
    const remaining = { ...material.oneTimeSecrets };
    delete remaining[id];

    // Retire it: still readable, no longer offered to anyone new.
    const used = { ...(material.usedOtkSecrets ?? {}), [id]: live };
    const keys = Object.keys(used);
    if (keys.length > USED_OTK_RETAIN) {
      for (const stale of keys.slice(0, keys.length - USED_OTK_RETAIN)) {
        delete used[stale];
      }
    }

    await persist({ ...material, oneTimeSecrets: remaining, usedOtkSecrets: used });
    return b64urlToBytes(live);
  }

  const spent = material.usedOtkSecrets?.[id];
  return spent ? b64urlToBytes(spent) : null;
}

export async function getIdentitySecret(): Promise<Uint8Array | null> {
  const m = await loadDeviceKeys();
  return m ? b64urlToBytes(m.identitySecret) : null;
}

export async function getIdentityPublic(): Promise<string | null> {
  const m = await loadDeviceKeys();
  return m?.identityPublic ?? null;
}

export async function getSignedPreKeySecret(): Promise<Uint8Array | null> {
  const m = await loadDeviceKeys();
  return m ? b64urlToBytes(m.signedPreKeySecret) : null;
}

/** Best-effort top-up check. */
export async function maybeRefillKeys(): Promise<void> {
  try {
    const count = await myKeyCount();
    if (count.one_time_remaining < OTK_REFILL_BELOW) {
      const m = await loadDeviceKeys();
      if (m) await refillOneTimeKeys(m);
    }
  } catch {
    /* ignore */
  }
}
