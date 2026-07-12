import { existsSync, readFileSync } from 'node:fs';

function require_(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`missing required env var: ${name}`);
  }
  return v;
}

// Load a PEM file from disk. Returns undefined if the path is empty or the
// file doesn't exist (dev fallback for mTLS).
function readPEM(path: string | undefined): Buffer | undefined {
  if (!path || !existsSync(path)) return undefined;
  return readFileSync(path);
}

function mediaUploadFromWebhook(webhookUrl: string): string {
  // http://host:8080/api/internal/wa/events → …/media
  if (webhookUrl.includes('/api/internal/wa/events')) {
    return webhookUrl.replace(/\/api\/internal\/wa\/events\/?$/, '/api/internal/wa/media');
  }
  // Fallback: sibling path
  return webhookUrl.replace(/\/?$/, '') + '/../media';
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),

  // Where to POST events back to the Go API. In dev with mTLS this is
  // the internal HTTPS port (e.g. https://host.docker.internal:9090/…).
  webhookUrl: require_('SOCIALIZE_WEBHOOK_URL'),

  // Multipart media upload for decrypted WA attachments (defaults from webhook).
  mediaUploadUrl:
    process.env.SOCIALIZE_MEDIA_UPLOAD_URL ??
    mediaUploadFromWebhook(require_('SOCIALIZE_WEBHOOK_URL')),

  internalToken: require_('SOCIALIZE_INTERNAL_TOKEN'),

  authRoot: process.env.WA_AUTH_ROOT ?? './auth_info',

  // How many history (type=append) messages to ingest after link/reconnect.
  historyBudget: parseInt(process.env.WA_HISTORY_BUDGET ?? '80', 10),

  browser: ['Socialize', 'Chrome', '120.0.0'] as [string, string, string],

  // ── mTLS client cert for webhook calls ──────────────────────────────────
  // When set, the bridge authenticates to the Go API with these credentials.
  // The CA cert is required to verify the server; the client cert+key are
  // required by the server's RequireAndVerifyClientCert setting.
  tls: {
    ca:     readPEM(process.env.TLS_CA_CERT),
    cert:   readPEM(process.env.TLS_CLIENT_CERT),
    key:    readPEM(process.env.TLS_CLIENT_KEY),
  },
};
