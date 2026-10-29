import { createRequire } from 'node:module';
import { pino } from 'pino';
import { env, isProduction } from '../env.js';

// Pretty output is a development nicety; pino-pretty is a dev dependency and absent from
// the production image, so only use it when it's actually installed.
function prettyTransportAvailable() {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

const pretty = !isProduction && env.NODE_ENV !== 'test' && prettyTransportAvailable();

export const logger = pino({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : isProduction ? 'info' : 'debug'),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.passwordHash'],
    censor: '[redacted]',
  },
  ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } } } : {}),
});
