import { Hono } from 'hono';

import { config } from './config.ts';
import { logger } from './logger.ts';
import { sendText, startPairing, status, unlink } from './manager.ts';

const app = new Hono();

// All endpoints require the shared internal token. Without this, anyone
// on the bridge's network could request pairing codes for any user_id.
app.use('/*', async (c, next) => {
  if (c.req.path === '/healthz') return next();
  const auth = c.req.header('authorization') ?? '';
  if (auth !== `Bearer ${config.internalToken}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return next();
});

app.get('/healthz', (c) => c.json({ status: 'ok' }));

/**
 * POST /pair/start { user_id, phone } → pairing code
 *
 * Phone is E.164 (with or without +). Baileys reuses on-disk creds for
 * this user_id if any exist, so retries don't generate fresh identities.
 */
app.post('/pair/start', async (c) => {
  const body = await c.req.json<{ user_id?: string; phone?: string }>();
  if (!body.user_id || !body.phone) {
    return c.json({ error: 'invalid_request' }, 400);
  }
  try {
    const result = await startPairing(body.user_id, body.phone);
    return c.json(result);
  } catch (err) {
    const message = (err as Error).message ?? 'pair_failed';
    logger.warn({ err, user: body.user_id, phone: body.phone }, 'pair start failed');

    // Try to give the Go side a useful classification — same buckets as
    // before, so the existing error mapping doesn't need to change.
    if (/timed?[- ]?out|rate[- ]?limit|429|overlimit/i.test(message)) {
      return c.json({ error: 'pairing_rate_limited', detail: message }, 429);
    }
    if (/400|bad[- ]?request|not on whatsapp|not registered/i.test(message)) {
      return c.json({ error: 'phone_not_on_whatsapp', detail: message }, 422);
    }
    return c.json({ error: 'pairing_failed', detail: message }, 502);
  }
});

app.get('/pair/status', (c) => {
  const userID = c.req.query('user_id');
  if (!userID) return c.json({ error: 'invalid_request' }, 400);
  return c.json(status(userID));
});

app.delete('/pair/:user_id', async (c) => {
  const userID = c.req.param('user_id');
  await unlink(userID);
  return c.body(null, 204);
});

/**
 * POST /messages/send { user_id, chat_jid, text }
 * Sends a text message on a linked Baileys session.
 */
app.post('/messages/send', async (c) => {
  const body = await c.req.json<{ user_id?: string; chat_jid?: string; text?: string }>();
  if (!body.user_id || !body.chat_jid || !body.text?.trim()) {
    return c.json({ error: 'invalid_request' }, 400);
  }
  try {
    const result = await sendText(body.user_id, body.chat_jid, body.text.trim());
    return c.json(result);
  } catch (err) {
    const message = (err as Error).message ?? 'send_failed';
    logger.warn({ err, user: body.user_id, chat: body.chat_jid }, 'send failed');
    if (/not_linked|session_not_linked/i.test(message)) {
      return c.json({ error: 'session_not_linked', detail: message }, 409);
    }
    return c.json({ error: 'send_failed', detail: message }, 502);
  }
});

export { app };
