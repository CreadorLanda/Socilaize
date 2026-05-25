import { serve } from '@hono/node-server';

import { config } from './config.ts';
import { logger } from './logger.ts';
import { app } from './routes.ts';

// Baileys' ws library can emit 'error' on a socket that's mid-handshake;
// if no listener catches it, Node treats it as fatal. Log + swallow at
// process level — every pair flow failure is already handled upstream.
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'wa-bridge: uncaught exception (suppressed)');
});
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'wa-bridge: unhandled rejection (suppressed)');
});

const server = serve({
  fetch: app.fetch,
  port: config.port,
});

logger.info({ port: config.port }, 'wa-bridge: listening');

// Drain WebSockets on signal so Baileys doesn't leave half-open
// connections behind across docker compose restarts.
const shutdown = () => {
  logger.info('wa-bridge: shutdown');
  server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
