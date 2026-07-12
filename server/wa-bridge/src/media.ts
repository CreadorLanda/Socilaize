import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { parse } from 'node:url';

import { config } from './config.ts';
import { logger } from './logger.ts';

/**
 * Upload decrypted WhatsApp media bytes to the Go API internal endpoint.
 * Returns the stable Socialize media URL (/api/media/{id}/file) or empty
 * string on failure (caller still stores the message without media).
 */
export async function uploadMediaToAPI(
  userID: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  const url = parse(config.mediaUploadUrl);
  const isHTTPS = url.protocol === 'https:';
  const boundary = `----SocilaizeWA${Date.now().toString(36)}`;

  const preamble = Buffer.from(
    [
      `--${boundary}`,
      `Content-Disposition: form-data; name="user_id"`,
      ``,
      userID,
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename.replace(/"/g, '')}"`,
      `Content-Type: ${contentType || 'application/octet-stream'}`,
      ``,
      ``,
    ].join('\r\n'),
    'utf8',
  );
  const closing = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([preamble, buffer, closing]);

  const opts: Record<string, unknown> = {
    hostname: url.hostname,
    port: url.port || (isHTTPS ? 443 : 80),
    path: url.pathname || '/',
    method: 'POST',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      authorization: `Bearer ${config.internalToken}`,
      'content-length': body.length,
    },
    timeout: 30_000,
  };

  if (isHTTPS && config.tls.ca) {
    opts.ca = config.tls.ca;
    if (config.tls.cert) opts.cert = config.tls.cert;
    if (config.tls.key) opts.key = config.tls.key;
  }

  const mod = isHTTPS ? httpsRequest : httpRequest;

  return new Promise((resolve) => {
    const req = mod(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(raw) as { url?: string };
            resolve(parsed.url ?? '');
            return;
          } catch {
            /* fall through */
          }
        }
        logger.warn(
          { status: res.statusCode, user: userID, body: raw.slice(0, 200) },
          'media upload non-2xx',
        );
        resolve('');
      });
    });
    req.on('error', (err: Error) => {
      logger.warn({ err, user: userID }, 'media upload failed');
      resolve('');
    });
    req.on('timeout', () => {
      req.destroy();
      logger.warn({ user: userID }, 'media upload timeout');
      resolve('');
    });
    req.write(body);
    req.end();
  });
}

export function mimeForType(type: string): string {
  switch (type) {
    case 'image':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'audio':
      return 'audio/ogg';
    case 'sticker':
      return 'image/webp';
    case 'document':
      return 'application/octet-stream';
    default:
      return 'application/octet-stream';
  }
}

export function filenameForType(type: string, waId: string): string {
  switch (type) {
    case 'image':
      return `wa-${waId}.jpg`;
    case 'video':
      return `wa-${waId}.mp4`;
    case 'audio':
      return `wa-${waId}.ogg`;
    case 'sticker':
      return `wa-${waId}.webp`;
    case 'document':
      return `wa-${waId}.bin`;
    default:
      return `wa-${waId}.bin`;
  }
}
