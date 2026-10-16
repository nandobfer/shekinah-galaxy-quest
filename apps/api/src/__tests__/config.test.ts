import { describe, expect, it } from 'vitest';
import { readConfig } from '../config.js';

const env = { MONGODB_URI: 'mongodb://localhost/test', AUTH_SECRET: 'test-secret-at-least-thirty-two-characters', APP_ORIGIN: 'http://localhost:5180' };
describe('configuração segura', () => {
  it('exige segredo forte e URI MongoDB', () => {
    expect(() => readConfig({ ...env, AUTH_SECRET: 'short' })).toThrow();
    expect(() => readConfig({ ...env, MONGODB_URI: 'postgres://localhost/test' })).toThrow();
  });
  it('exige origem canônica e HTTPS em produção', () => {
    expect(() => readConfig({ ...env, APP_ORIGIN: 'http://localhost:5180/' })).toThrow();
    expect(() => readConfig({ ...env, NODE_ENV: 'production' })).toThrow();
    expect(readConfig({ ...env, NODE_ENV: 'production', APP_ORIGIN: 'https://admin.example.test' }).NODE_ENV).toBe('production');
  });
});
