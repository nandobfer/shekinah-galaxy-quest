import { describe, expect, it } from 'vitest';
import { createAdminSchema, loginSchema, sessionSchema } from '../index';
describe('contratos de autenticação', () => {
  it('normaliza e-mail, mas preserva senha exatamente', () => {
    expect(loginSchema.parse({ email: ' ADMIN@EXAMPLE.TEST ', password: ' secret ' })).toEqual({ email: 'admin@example.test', password: ' secret ' });
  });
  it('valida limites de senha de cadastro, sem exigir nova política no login', () => {
    expect(createAdminSchema.safeParse({ name: 'Admin', email: 'admin@example.test', password: 'short' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'admin@example.test', password: 'short' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'admin@example.test', password: 'x'.repeat(129) }).success).toBe(false);
  });
  it('recusa sessão sem papel administrativo', () => {
    expect(sessionSchema.safeParse({ user: { id: '1', name: 'User', email: 'user@example.test', role: 'member' }, expires: '2030-01-01T00:00:00.000Z' }).success).toBe(false);
  });
});
