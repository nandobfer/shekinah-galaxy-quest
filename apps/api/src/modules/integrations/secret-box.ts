import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface SealedSecret { iv: string; tag: string; ciphertext: string; }
export function encryptionKey(value?: string): Buffer | undefined {
  if (!value) return undefined;
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw new Error('INTEGRATIONS_ENCRYPTION_KEY deve ser base64 de 32 bytes.');
  return key;
}
export function sealSecret(value: string, key: Buffer, context: string): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}
export function openSecret(value: SealedSecret, key: Buffer, context: string): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
  decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
