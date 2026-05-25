import { config } from './config.ts';
import { logger } from './logger.ts';

/**
 * Events the bridge emits back to the Go API. The Go side knows these
 * names and maps them to wa_bridges status changes.
 */
export type BridgeEvent =
  | { type: 'pair_success'; user_id: string; jid: string }
  | { type: 'pair_error'; user_id: string; reason: string }
  | { type: 'logged_out'; user_id: string }
  | { type: 'connection'; user_id: string; state: 'open' | 'connecting' | 'close' };

/**
 * Fire-and-forget POST with a 3s deadline. The shared internal token goes
 * in the Authorization header; the Go side rejects without it. We never
 * await this from request-handling paths — bridge events shouldn't block
 * Baileys' own event loop.
 */
export async function postEvent(evt: BridgeEvent): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.internalToken}`,
      },
      body: JSON.stringify(evt),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn({ status: res.status, evt }, 'webhook: non-2xx');
    }
  } catch (err) {
    logger.warn({ err, evt }, 'webhook: post failed');
  } finally {
    clearTimeout(timeout);
  }
}
