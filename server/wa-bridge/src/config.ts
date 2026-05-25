/**
 * Single source of truth for env config. Fail fast if anything required is
 * missing — the sidecar must not start in a half-configured state.
 */

function require_(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  // Where the HTTP server listens. Inside docker-compose this is reached as
  // http://wa-bridge:3001 from the Go service; in dev as localhost:3001.
  port: parseInt(process.env.PORT ?? '3001', 10),

  // Where to POST events (pair success, logged out, etc.) back to the Go API.
  webhookUrl: require_('SOCIALIZE_WEBHOOK_URL'),

  // Shared secret. Both sides check it. Mint with `openssl rand -hex 32`.
  internalToken: require_('SOCIALIZE_INTERNAL_TOKEN'),

  // Where Baileys persists per-user auth state. One subdir per user_id.
  authRoot: process.env.WA_AUTH_ROOT ?? './auth_info',

  // Browser identity tuple sent to WhatsApp. Baileys recommends a real-
  // looking triple so the server treats us like Chrome instead of bot.
  browser: ['Socialize', 'Chrome', '120.0.0'] as [string, string, string],
};
