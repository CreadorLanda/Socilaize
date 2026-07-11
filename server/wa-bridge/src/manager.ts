import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import { Boom } from '@hapi/boom';
import baileysPkg, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WAMessageKey,
  type WASocket,
} from '@whiskeysockets/baileys';

// Baileys ships as CommonJS. When imported from ESM, the runtime default
// can be either makeWASocket directly OR wrapped under `.default` depending
// on Node version and loader. Unwrap defensively.
const makeWASocket: typeof baileysPkg =
  (baileysPkg as unknown as { default?: typeof baileysPkg }).default ?? baileysPkg;

import { config } from './config.ts';
import { logger } from './logger.ts';
import { postEvent } from './webhook.ts';

/**
 * Owns per-user Baileys sockets. One entry per user_id; the auth state
 * lives on disk under `auth_info/<user_id>/` so it survives restarts —
 * this is the Baileys equivalent of whatsmeow's sqlstore device row, and
 * is the key advantage we're chasing by switching: on retry the SAME
 * noise/identity keys are reused, so WhatsApp sees one client reconnecting
 * instead of N strangers.
 */

type PairingResult = {
  pairing_code: string;
  expires_at: string; // ISO
};

type StatusSnapshot = {
  status: 'pending' | 'linked' | 'failed' | 'disconnected';
  phone?: string;
  jid?: string;
  last_error?: string;
};

class Session {
  sock: WASocket | null = null;
  phone: string | null = null;
  lastError: string | null = null;
  status: StatusSnapshot['status'] = 'disconnected';
}

const sessions = new Map<string, Session>();

function authDir(userID: string): string {
  return path.join(config.authRoot, userID);
}

function getOrCreate(userID: string): Session {
  let s = sessions.get(userID);
  if (!s) {
    s = new Session();
    sessions.set(userID, s);
  }
  return s;
}

/**
 * Spin up a Baileys socket for the user (reusing on-disk creds if any),
 * request a phone-pairing code, and arm the connection.update listener
 * that updates the on-disk creds, posts events back to Go, and marks
 * status transitions.
 */
export async function startPairing(userID: string, phone: string): Promise<PairingResult> {
  const session = getOrCreate(userID);
  session.phone = phone;
  session.lastError = null;
  session.status = 'pending';

  // Tear down a lingering socket cleanly so we don't have two trying to
  // hold the same auth state at once.
  if (session.sock) {
    safeEnd(session.sock);
    session.sock = null;
  }

  const dir = authDir(userID);
  mkdirSync(dir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    browser: config.browser,
    logger: logger.child({ component: 'baileys', user: userID }) as any,
  });

  session.sock = sock;

  // Persist creds on every update — same as Baileys' own example. Without
  // this the next pair attempt would NOT see the same noise key on disk
  // and we'd lose the whole point of switching off whatsmeow.
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection) {
      logger.info({ user: userID, connection }, 'wa: connection update');
      postEvent({ type: 'connection', user_id: userID, state: connection as any });
    }

    if (connection === 'open') {
      session.status = 'linked';
      const jid = sock.user?.id ?? '';
      postEvent({ type: 'pair_success', user_id: userID, jid });
    }

    if (connection === 'close') {
      const code =
        (lastDisconnect?.error as Boom | undefined)?.output?.statusCode ?? 0;
      const reason = lastDisconnect?.error?.message ?? `close_code_${code}`;

      if (code === DisconnectReason.loggedOut) {
        session.status = 'disconnected';
        session.sock = null;
        // The on-disk creds are now useless — wipe so the next pair
        // attempt starts fresh.
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          /* best effort */
        }
        postEvent({ type: 'logged_out', user_id: userID });
        return;
      }

      // Any other close while we're still in 'pending' is a pair failure.
      if (session.status === 'pending') {
        session.status = 'failed';
        session.lastError = reason;
        postEvent({ type: 'pair_error', user_id: userID, reason });
      }
    }
  });

  // ── Incoming messages ────────────────────────────────────────────────────
  // Relay incoming WhatsApp messages to the Go API. We only forward
  // real-time notifications (type === 'notify'), skip our own outgoing
  // messages, and classify the content safely.
  //
  // Security: content is never logged; message IDs and JIDs are logged at
  // debug only. The Go side validates JID format and caps content length.
  sock.ev.on('messages.upsert', (incoming) => {
    // 'notify' is a new real-time message. 'append' is history sync —
    // skip those to avoid flooding the DB on reconnect.
    if (incoming.type !== 'notify') return;

    for (const msg of incoming.messages) {
      try {
        // Skip our own sent messages (fromMe === true).
        if (msg.key?.fromMe) continue;

        const key: WAMessageKey | undefined = msg.key;
        if (!key?.id || !key?.remoteJid) continue;

        const remoteJid = key.remoteJid;
        const senderJid = key.participant ?? remoteJid;
        const waTimestamp = typeof msg.messageTimestamp === 'number'
          ? msg.messageTimestamp
          : Math.floor(Date.now() / 1000);

        // Extract text content from the various WhatsApp message types.
        const extracted = extractMessageContent(msg);
        if (!extracted) continue; // unsupported type, skip silently

        logger.debug({ wa_id: key.id, type: extracted.type, chat: remoteJid }, 'wa: incoming message');

        postEvent({
          type: 'message',
          user_id: userID,
          wa_message_id: key.id,
          chat_jid: remoteJid,
          sender_jid: senderJid,
          content: extracted.content,
          message_type: extracted.type,
          media_url: extracted.mediaUrl,
          wa_timestamp: waTimestamp,
        });
      } catch (err) {
        logger.warn({ err, wa_id: msg.key?.id }, 'wa: failed to process incoming message');
      }
    }
  });

  // If we already had creds on disk, no pairing is needed — the connection
  // will re-authenticate via the persisted keys and emit 'open' shortly.
  if (sock.authState.creds.registered) {
    return {
      pairing_code: '',
      // Effectively never expires — the caller should ignore the code
      // when registered is true and poll /status for 'linked'.
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  // Fresh device — request a phone-pairing code. CRITICAL: the noise
  // handshake must finish first; otherwise requestPairingCode() fires
  // before the socket has anywhere to send the IQ and we get
  // "Connection Closed". Wait for the first non-'close' connection
  // event (Baileys raises 'connecting' or emits a qr field once the
  // handshake settles).
  await waitForReady(sock, 10000);

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  let rawCode: string;
  try {
    rawCode = await sock.requestPairingCode(cleanPhone);
  } catch (err) {
    session.status = 'failed';
    session.lastError = (err as Error).message;
    safeEnd(sock);
    session.sock = null;
    throw err;
  }

  return {
    pairing_code: formatPairingCode(rawCode),
    expires_at: new Date(Date.now() + 120 * 1000).toISOString(),
  };
}

export function status(userID: string): StatusSnapshot {
  const s = sessions.get(userID);
  if (!s) return { status: 'disconnected' };
  const out: StatusSnapshot = {
    status: s.status,
    ...(s.phone ? { phone: s.phone } : {}),
    ...(s.sock?.user?.id ? { jid: s.sock.user.id } : {}),
    ...(s.lastError ? { last_error: s.lastError } : {}),
  };
  return out;
}

export async function unlink(userID: string): Promise<void> {
  const s = sessions.get(userID);
  if (!s) return;
  if (s.sock) {
    try {
      await s.sock.logout('user_request');
    } catch {
      /* if already gone or never logged in, fine */
    }
    safeEnd(s.sock);
  }
  sessions.delete(userID);
  const dir = authDir(userID);
  if (existsSync(dir)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

/**
 * Safely extract content from a Baileys message object. Returns null for
 * unsupported types. Content is truncated to 64 KB to match the DB limit.
 *
 * Supported types: conversation, extendedTextMessage, imageMessage,
 * videoMessage, audioMessage, documentMessage, stickerMessage,
 * locationMessage, contactMessage.
 */
function extractMessageContent(msg: any): { type: string; content: string; mediaUrl: string } | null {
  const m = msg.message;
  if (!m) return null;

  const maxLen = 65536;

  // Type classification priority: richer types first.
  if (m.conversation) {
    return { type: 'text', content: String(m.conversation).slice(0, maxLen), mediaUrl: '' };
  }
  if (m.extendedTextMessage?.text) {
    return { type: 'text', content: String(m.extendedTextMessage.text).slice(0, maxLen), mediaUrl: '' };
  }
  if (m.imageMessage) {
    return {
      type: 'image',
      content: (m.imageMessage.caption ?? '').slice(0, maxLen),
      mediaUrl: m.imageMessage.url ?? '',
    };
  }
  if (m.videoMessage) {
    return {
      type: 'video',
      content: (m.videoMessage.caption ?? '').slice(0, maxLen),
      mediaUrl: m.videoMessage.url ?? '',
    };
  }
  if (m.audioMessage) {
    return { type: 'audio', content: '', mediaUrl: m.audioMessage.url ?? '' };
  }
  if (m.documentMessage) {
    return {
      type: 'document',
      content: (m.documentMessage.caption ?? m.documentMessage.title ?? '').slice(0, maxLen),
      mediaUrl: m.documentMessage.url ?? '',
    };
  }
  if (m.stickerMessage) {
    return { type: 'sticker', content: '', mediaUrl: m.stickerMessage.url ?? '' };
  }
  if (m.locationMessage) {
    const lat = m.locationMessage.degreesLatitude ?? 0;
    const lng = m.locationMessage.degreesLongitude ?? 0;
    return { type: 'location', content: `${lat},${lng}`, mediaUrl: '' };
  }
  if (m.contactMessage) {
    return { type: 'contact', content: m.contactMessage.displayName ?? '', mediaUrl: '' };
  }

  // Protocol reaction messages, edit messages, payment messages, etc. —
  // not user-visible content, skip.
  return null;
}

function formatPairingCode(raw: string): string {
  if (raw.length === 8) return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  return raw;
}

/**
 * Block until Baileys is ready to send IQs. The trigger we wait for is
 * the `qr` field on connection.update — Baileys emits it once the noise
 * handshake completes and WhatsApp has handed us a fresh pairing nonce.
 * Even when we plan to use phone pairing (not QR scan), this signal still
 * fires and is the only reliable "the socket is now usable" event.
 *
 * 'connecting' is too early (WS open, but noise not done yet);
 * 'open' is too late (only fires AFTER pairing succeeds);
 * `qr` is exactly right.
 */
function waitForReady(sock: WASocket, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const off = () => sock.ev.off('connection.update', handler);
    const timer = setTimeout(() => {
      off();
      reject(new Error('timed out waiting for socket handshake'));
    }, timeoutMs);

    const handler = (update: { connection?: string; qr?: string }) => {
      if (update.qr) {
        clearTimeout(timer);
        off();
        resolve();
      } else if (update.connection === 'close') {
        clearTimeout(timer);
        off();
        reject(new Error('connection closed before handshake'));
      }
    };
    sock.ev.on('connection.update', handler);
  });
}

/**
 * Cleanly tear down a Baileys socket. Wraps the call so callers can
 * fire-and-forget — if the socket never opened, ws throws "WebSocket
 * was closed before the connection was established", and we don't care.
 */
function safeEnd(sock: WASocket): void {
  try {
    sock.end(undefined);
  } catch {
    /* ignore — socket likely never connected */
  }
}
