import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { parse } from 'node:url';

import { config } from './config.ts';
import { logger } from './logger.ts';

export type BridgeEvent =
  | { type: 'pair_success'; user_id: string; jid: string }
  | { type: 'pair_error'; user_id: string; reason: string }
  | { type: 'logged_out'; user_id: string }
  | { type: 'connection'; user_id: string; state: 'open' | 'connecting' | 'close' }
  | {
      type: 'message';
      user_id: string;
      wa_message_id: string;
      chat_jid: string;
      sender_jid: string;
      content: string;
      message_type: string;
      media_url: string;
      wa_timestamp: number;
    };

/**
 * Fire-and-forget POST with a 3s deadline, using the Node http/https module
 * so we can pass TLS client certs for mTLS authentication to the Go API.
 */
export async function postEvent(evt: BridgeEvent): Promise<void> {
  const url = parse(config.webhookUrl);
  const body = JSON.stringify(evt);
  const isHTTPS = url.protocol === 'https:';

  const opts: Record<string, any> = {
    hostname: url.hostname,
    port: url.port || (isHTTPS ? 443 : 80),
    path: url.pathname || '/',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.internalToken}`,
      'content-length': Buffer.byteLength(body),
    },
    timeout: 3000,
  };

  // Attach mTLS client certs when configured.
  if (isHTTPS && config.tls.ca) {
    opts.ca = config.tls.ca;
    if (config.tls.cert) opts.cert = config.tls.cert;
    if (config.tls.key) opts.key = config.tls.key;
  }

  const mod = isHTTPS ? httpsRequest : httpRequest;

  return new Promise<void>((resolve) => {
    const req = mod(opts, (res) => {
      if (res.statusCode !== 204 && res.statusCode !== 200) {
        logger.warn({ status: res.statusCode, type: evt.type }, 'webhook: non-2xx');
      }
      res.resume();
      resolve();
    });

    req.on('error', (err: Error) => {
      logger.warn({ err, type: evt.type }, 'webhook: request failed (next event will retry)');
      resolve(); // never reject — fire-and-forget
    });

    req.on('timeout', () => {
      req.destroy();
      logger.warn({ type: evt.type }, 'webhook: timeout');
      resolve();
    });

    req.write(body);
    req.end();
  });
}
