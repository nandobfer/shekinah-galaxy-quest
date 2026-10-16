import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AuthError, createApiClient } from '../index';

let server: Server;
let baseURL: string;
let mode: 'success' | 'invalid' | 'rate' | 'offline' | 'anonymous' = 'success';
let calls: string[];
beforeAll(async () => {
  server = createServer(async (req, res) => {
    calls.push(`${req.method} ${req.url}`);
    res.setHeader('content-type', 'application/json');
    if (mode === 'offline') { res.statusCode = 503; res.end('{}'); return; }
    if (req.url === '/api/v1/auth/csrf') { res.end(JSON.stringify({ csrfToken: 'csrf-test-token' })); return; }
    if (req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk;
      expect(new URLSearchParams(body).get('csrfToken')).toBe('csrf-test-token');
      if (mode === 'rate') { res.statusCode = 429; res.end('{}'); return; }
      res.end(JSON.stringify({ url: mode === 'invalid' ? 'http://localhost/login?error=CredentialsSignin' : 'http://localhost/' })); return;
    }
    if (mode === 'anonymous') { res.statusCode = 401; res.end('{}'); return; }
    res.end(JSON.stringify({ user: { id: '1', name: 'Admin', email: 'admin@example.test', role: 'admin' }, expires: '2030-01-01T00:00:00.000Z' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
beforeEach(() => { mode = 'success'; calls = []; });
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

describe('cliente HTTP de autenticação', () => {
  it('obtém CSRF, autentica e reconcilia sessão, sem duplicar prefixo', async () => {
    const client = createApiClient({ baseURL });
    expect((await client.login({ email: 'ADMIN@example.test', password: 'test' })).user.role).toBe('admin');
    expect(calls).toEqual(['GET /api/v1/auth/csrf', 'POST /api/v1/auth/callback/credentials', 'GET /api/v1/me']);
    await client.logout();
    expect(calls.slice(-2)).toEqual(['GET /api/v1/auth/csrf', 'POST /api/v1/auth/signout']);
  });
  it('traduz credenciais inválidas sem repetir mutação', async () => {
    mode = 'invalid';
    await expect(createApiClient({ baseURL }).login({ email: 'admin@example.test', password: 'test' })).rejects.toMatchObject({ code: 'credentials' });
    expect(calls.filter(call => call.startsWith('POST'))).toHaveLength(1);
  });
  it('traduz limite e indisponibilidade para erro acionável', async () => {
    mode = 'rate';
    await expect(createApiClient({ baseURL }).login({ email: 'admin@example.test', password: 'test' })).rejects.toMatchObject({ code: 'rate_limit' });
    mode = 'offline';
    await expect(createApiClient({ baseURL }).session()).rejects.toBeInstanceOf(AuthError);
  });
  it('informa expiração e retorna ausência de sessão', async () => {
    mode = 'anonymous'; const onUnauthorized = vi.fn();
    expect(await createApiClient({ baseURL, onUnauthorized }).session()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
