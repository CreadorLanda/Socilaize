import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';

import { bundleForUsername, type PreKeyBundle } from '@/data/api/keys';

import {
  getIdentityPublic,
  getIdentitySecret,
  getSignedPreKeySecret,
  takeOtkSecret,
} from './device-keys';
import { b64urlToBytes, bytesToB64url, utf8Decode, utf8Encode } from './encoding';

const SESSION_PREFIX = 'e2ee.session.v1.';
const ENVELOPE_PREFIX = 'soc1.';

export type SessionRecord = {
  peerUserId: string;
  peerIdentityPublic: string;
  /** Shared 32-byte key (base64url). */
  rootKey: string;
  /** Monotonic send counter for simple ratchet. */
  sendN: number;
  recvN: number;
  establishedAt: string;
};

export type EnvelopeHeader = {
  v: 1;
  /** Sender identity public (X25519). */
  ik: string;
  /** Ephemeral public for this message (first msg) or omitted for ratchet. */
  ek?: string;
  /** Optional OTK id the sender consumed from the recipient's bundle. */
  otk_id?: number;
  spk_id?: number;
  n: number; // message number
};

function sessionKey(peerUserId: string) {
  return SESSION_PREFIX + peerUserId;
}

export async function loadSession(peerUserId: string): Promise<SessionRecord | null> {
  const raw = await SecureStore.getItemAsync(sessionKey(peerUserId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

async function saveSession(s: SessionRecord): Promise<void> {
  await SecureStore.setItemAsync(sessionKey(s.peerUserId), JSON.stringify(s));
}

function hkdfLike(ikm: Uint8Array, info: string): Uint8Array {
  // Simple expand: hash(ikm || info) then hash again for 32 bytes.
  const infoBytes = utf8Encode(info);
  const buf = new Uint8Array(ikm.length + infoBytes.length);
  buf.set(ikm, 0);
  buf.set(infoBytes, ikm.length);
  return nacl.hash(buf).slice(0, 32);
}

/**
 * X3DH-lite: DH(IKa, SPKb) || DH(EKa, IKb) || DH(EKa, SPKb) [|| DH(EKa, OTKb)]
 */
function deriveRoot(
  aliceIkSecret: Uint8Array,
  aliceEkSecret: Uint8Array,
  bobIkPublic: Uint8Array,
  bobSpkPublic: Uint8Array,
  bobOtkPublic?: Uint8Array,
): Uint8Array {
  const dh1 = nacl.scalarMult(aliceIkSecret, bobSpkPublic);
  const dh2 = nacl.scalarMult(aliceEkSecret, bobIkPublic);
  const dh3 = nacl.scalarMult(aliceEkSecret, bobSpkPublic);
  let cat = new Uint8Array(dh1.length + dh2.length + dh3.length);
  cat.set(dh1, 0);
  cat.set(dh2, dh1.length);
  cat.set(dh3, dh1.length + dh2.length);
  if (bobOtkPublic) {
    const dh4 = nacl.scalarMult(aliceEkSecret, bobOtkPublic);
    const next = new Uint8Array(cat.length + dh4.length);
    next.set(cat, 0);
    next.set(dh4, cat.length);
    cat = next;
  }
  return hkdfLike(cat, 'Socialize-X3DH-v1');
}

/** Initiator: fetch peer bundle and establish a session. */
export async function establishSessionAsInitiator(
  peerUserId: string,
  peerUsername: string,
): Promise<SessionRecord> {
  const existing = await loadSession(peerUserId);
  if (existing) return existing;

  const ikSecret = await getIdentitySecret();
  const ikPublic = await getIdentityPublic();
  if (!ikSecret || !ikPublic) {
    throw new Error('local_keys_missing');
  }

  const bundle: PreKeyBundle = await bundleForUsername(peerUsername);
  const bobIk = b64urlToBytes(bundle.identity_key);
  const bobSpk = b64urlToBytes(bundle.signed_pre_key.public_key);
  const bobOtk = bundle.one_time_pre_key
    ? b64urlToBytes(bundle.one_time_pre_key.public_key)
    : undefined;

  const ek = nacl.box.keyPair();
  const root = deriveRoot(ikSecret, ek.secretKey, bobIk, bobSpk, bobOtk);

  const session: SessionRecord = {
    peerUserId,
    peerIdentityPublic: bundle.identity_key,
    rootKey: bytesToB64url(root),
    sendN: 0,
    recvN: 0,
    establishedAt: new Date().toISOString(),
  };
  await saveSession(session);

  // Stash the ephemeral secret for the first outbound encrypt (same process).
  pendingEphemeral.set(peerUserId, {
    publicKey: bytesToB64url(ek.publicKey),
    secretKey: bytesToB64url(ek.secretKey),
    otkId: bundle.one_time_pre_key?.key_id,
    spkId: bundle.signed_pre_key.key_id,
  });

  return session;
}

const pendingEphemeral = new Map<
  string,
  { publicKey: string; secretKey: string; otkId?: number; spkId?: number }
>();

/**
 * Responder: peer sent an envelope with header.ek — derive session from
 * our SPK/OTK secrets + their IK/EK.
 */
export async function establishSessionAsResponder(
  peerUserId: string,
  header: EnvelopeHeader,
): Promise<SessionRecord | null> {
  const existing = await loadSession(peerUserId);
  if (existing) return existing;
  if (!header.ek || !header.ik) return null;

  const spkSecret = await getSignedPreKeySecret();
  const ikSecret = await getIdentitySecret();
  if (!spkSecret || !ikSecret) return null;

  const aliceIk = b64urlToBytes(header.ik);
  const aliceEk = b64urlToBytes(header.ek);

  // Mirror of initiator DHs with roles swapped:
  // dh1 = DH(SPKb, IKa) = DH(IKa, SPKb)
  // dh2 = DH(IKb, EKa)
  // dh3 = DH(SPKb, EKa)
  // dh4 = DH(OTKb, EKa)
  const dh1 = nacl.scalarMult(spkSecret, aliceIk);
  const dh2 = nacl.scalarMult(ikSecret, aliceEk);
  const dh3 = nacl.scalarMult(spkSecret, aliceEk);
  let cat = new Uint8Array(dh1.length + dh2.length + dh3.length);
  cat.set(dh1, 0);
  cat.set(dh2, dh1.length);
  cat.set(dh3, dh1.length + dh2.length);

  if (header.otk_id != null) {
    const otkSecret = await takeOtkSecret(header.otk_id);
    if (otkSecret) {
      const dh4 = nacl.scalarMult(otkSecret, aliceEk);
      const next = new Uint8Array(cat.length + dh4.length);
      next.set(cat, 0);
      next.set(dh4, cat.length);
      cat = next;
    }
  }

  const root = hkdfLike(cat, 'Socialize-X3DH-v1');
  const session: SessionRecord = {
    peerUserId,
    peerIdentityPublic: header.ik,
    rootKey: bytesToB64url(root),
    sendN: 0,
    recvN: 0,
    establishedAt: new Date().toISOString(),
  };
  await saveSession(session);
  return session;
}

function messageKey(root: Uint8Array, n: number): Uint8Array {
  return hkdfLike(root, `msg-${n}`);
}

function nonceFromCounter(n: number): Uint8Array {
  const nonce = new Uint8Array(24);
  const view = new DataView(nonce.buffer);
  view.setUint32(0, n, false);
  view.setUint32(4, 0x534f4349 /* SOCI */, false);
  return nonce;
}

export function isEnvelope(content: string): boolean {
  return content.startsWith(ENVELOPE_PREFIX);
}

/** Encrypt plaintext for peer. May include X3DH header on first message. */
export async function encryptForPeer(
  peerUserId: string,
  plaintext: string,
  opts?: { peerUsername?: string },
): Promise<string> {
  let session = await loadSession(peerUserId);
  if (!session && opts?.peerUsername) {
    session = await establishSessionAsInitiator(peerUserId, opts.peerUsername);
  }
  if (!session) {
    throw new Error('session_missing');
  }

  const ikPublic = await getIdentityPublic();
  if (!ikPublic) throw new Error('local_keys_missing');

  const root = b64urlToBytes(session.rootKey);
  const n = session.sendN;
  const mk = messageKey(root, n);
  const nonce = nonceFromCounter(n);
  const boxed = nacl.secretbox(utf8Encode(plaintext), nonce, mk);
  if (!boxed) throw new Error('encrypt_failed');

  const header: EnvelopeHeader = {
    v: 1,
    ik: ikPublic,
    n,
  };
  const pending = pendingEphemeral.get(peerUserId);
  if (pending && n === 0) {
    header.ek = pending.publicKey;
    if (pending.otkId != null) header.otk_id = pending.otkId;
    if (pending.spkId != null) header.spk_id = pending.spkId;
    pendingEphemeral.delete(peerUserId);
  }

  session.sendN = n + 1;
  await saveSession(session);

  const headerB64 = bytesToB64url(utf8Encode(JSON.stringify(header)));
  const bodyB64 = bytesToB64url(boxed);
  return `${ENVELOPE_PREFIX}${headerB64}.${bodyB64}`;
}

/** Decrypt an envelope. Falls back to raw content if not encrypted. */
export async function decryptFromPeer(
  peerUserId: string,
  content: string,
): Promise<string> {
  if (!isEnvelope(content)) return content;

  const rest = content.slice(ENVELOPE_PREFIX.length);
  const dot = rest.indexOf('.');
  if (dot < 0) return content;
  let header: EnvelopeHeader;
  try {
    header = JSON.parse(utf8Decode(b64urlToBytes(rest.slice(0, dot)))) as EnvelopeHeader;
  } catch {
    return content;
  }
  const body = b64urlToBytes(rest.slice(dot + 1));

  let session = await loadSession(peerUserId);
  if (!session && header.ek) {
    session = await establishSessionAsResponder(peerUserId, header);
  }
  if (!session) {
    return '[encrypted message — missing keys]';
  }

  const root = b64urlToBytes(session.rootKey);
  const mk = messageKey(root, header.n);
  const nonce = nonceFromCounter(header.n);
  const opened = nacl.secretbox.open(body, nonce, mk);
  if (!opened) {
    return '[encrypted message — cannot decrypt]';
  }

  if (header.n >= session.recvN) {
    session.recvN = header.n + 1;
    await saveSession(session);
  }
  return utf8Decode(opened);
}

export async function clearSession(peerUserId: string): Promise<void> {
  await SecureStore.deleteItemAsync(sessionKey(peerUserId));
}
