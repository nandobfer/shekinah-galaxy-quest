import { describe, expect, it } from 'vitest';
import { encryptionKey, sealSecret, openSecret } from '../secret-box.js';

describe('segredos AES-256-GCM', () => {
  it('preserva valor exato, usa IV aleatório e exige contexto correto', () => {
    const key = encryptionKey(Buffer.alloc(32, 1).toString('base64'))!;
    const value = '  token-acentuado-ç  ';
    const sealed = sealSecret(value, key, 'smtp:password');
    expect(openSecret(sealed, key, 'smtp:password')).toBe(value);
    expect(sealSecret(value, key, 'smtp:password')).not.toEqual(sealed);
    expect(() => openSecret(sealed, key, 'pusher:secret')).toThrow();
    expect(() => openSecret(sealed, Buffer.alloc(32, 2), 'smtp:password')).toThrow();
    expect(() => openSecret({ ...sealed, tag: Buffer.alloc(16).toString('base64') }, key, 'smtp:password')).toThrow();
  });
  it('recusa chaves fracas, truncadas ou não canônicas', () => {
    expect(encryptionKey()).toBeUndefined();
    expect(encryptionKey('')).toBeUndefined();
    for (const key of ['weak', 'a'.repeat(32), Buffer.alloc(31).toString('base64'), `${Buffer.alloc(32).toString('base64')}\n`]) expect(() => encryptionKey(key)).toThrow();
  });
});
