import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiClient } from '../index';

let server: Server;
let baseURL: string;
let status = 200;
let body: unknown;
const calls: { path?: string; method?: string; header?: string | string[] }[] = [];
beforeAll(async () => {
  server = createServer((req, res) => {
    calls.push({ path: req.url, method: req.method, header: req.headers['x-shekinah-request'] });
    res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(() => { calls.length = 0; status = 200; body = []; });
describe('cliente centralizado de integrações', () => {
  it('usa prefixo correto, valida respostas e inclui header de mutação', async () => {
    const api = createApiClient({ baseURL });
    expect(await api.integrations.list()).toEqual([]);
    body = { state: 'ok', message: 'Conectado', checkedAt: new Date().toISOString(), latencyMs: 1 };
    await api.integrations.test('pusher');
    expect(calls).toEqual([{ path: '/api/v1/integrations', method: 'GET', header: undefined }, { path: '/api/v1/integrations/pusher/test', method: 'POST', header: '1' }]);
    body = { invalid: true }; await expect(api.integrations.list()).rejects.toThrow('Não foi possível');
  });
  it('propaga sessão expirada ao cache e não repete mutação em conflito', async () => {
    const unauthorized = vi.fn(); const api = createApiClient({ baseURL, onUnauthorized: unauthorized });
    status = 401; await expect(api.integrations.list()).rejects.toMatchObject({ code: 'session' });
    expect(unauthorized).toHaveBeenCalledOnce();
    status = 409; body = { message: 'Configuração alterada. Recarregue.' };
    await expect(api.integrations.test('smtp')).rejects.toThrow('Configuração alterada.');
    expect(calls.filter(call => call.method === 'POST')).toHaveLength(1);
  });
});
