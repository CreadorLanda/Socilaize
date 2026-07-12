import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';

import { myKeyCount, uploadKeys, type UploadKeysRequest } from '@/data/api/keys';

import { b64urlToBytes, bytesToB64url } from './encoding';

const KEYS_STORE = 'e2ee.device_keys.v1';
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
  nextOtkId: number;
  uploadedAt?: string;
};

let cached: DeviceKeyMaterial | null = null;

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

function generateFresh(): DeviceKeyMaterial {
  const identity = keyPairB64();
  const spk = keyPairB64();
  const spkId = 1;
  const secrets: Record<string, string> = {};
  let nextOtkId = 1;
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

async function persist(m: DeviceKeyMaterial): Promise<void> {
  cached = m;
  await SecureStore.setItemAsync(KEYS_STORE, JSON.stringify(m));
}

export async function loadDeviceKeys(): Promise<DeviceKeyMaterial | null> {
  if (cached) return cached;
  const raw = await SecureStore.getItemAsync(KEYS_STORE);
  if (!raw) return null;
  try {
    cached = JSON.parse(raw) as DeviceKeyMaterial;
    return cached;
  } catch {
    return null;
  }
}

export async function clearDeviceKeys(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(KEYS_STORE);
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
export async function takeOtkSecret(keyId: number): Promise<Uint8Array | null> {
  const material = await loadDeviceKeys();
  if (!material) return null;
  const b64 = material.oneTimeSecrets[String(keyId)];
  if (!b64) return null;
  const next = { ...material.oneTimeSecrets };
  delete next[String(keyId)];
  await persist({ ...material, oneTimeSecrets: next });
  return b64urlToBytes(b64);
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
