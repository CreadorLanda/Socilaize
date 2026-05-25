import pino from 'pino';

/**
 * Pretty-printed in dev, JSON-lines in prod. Pino's overhead is negligible
 * and we want structured logs so the Go side (which already logs as JSON)
 * stays consistent end-to-end.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l' },
        },
});
