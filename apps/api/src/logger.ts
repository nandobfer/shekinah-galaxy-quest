import pino from 'pino';
export function createLogger(level = 'info') {
  return pino({ level, redact: { paths: ['password', 'passwordHash', 'cookie', 'authorization', 'secret'], censor: '[REDACTED]' } });
}
