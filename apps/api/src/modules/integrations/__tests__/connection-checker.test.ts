import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionChecker, CheckFailure } from '../connection-checker.js';

const mocks = vi.hoisted(() => ({ get: vi.fn(), pusher: vi.fn(), verify: vi.fn(), close: vi.fn(), smtp: vi.fn(), send: vi.fn(), destroy: vi.fn(), s3: vi.fn(), head: vi.fn() }));
vi.mock('pusher', () => ({ default: class { constructor(config: unknown) { mocks.pusher(config); } get = mocks.get; } }));
vi.mock('nodemailer', () => ({ default: { createTransport: (options: unknown) => { mocks.smtp(options); return { verify: mocks.verify, close: mocks.close }; } } }));
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: class { constructor(config: unknown) { mocks.s3(config); } send = mocks.send; destroy = mocks.destroy; }, HeadBucketCommand: class { constructor(input: unknown) { mocks.head(input); } } }));
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); mocks.get.mockResolvedValue({ ok: true, text: async () => '{}' }); mocks.verify.mockResolvedValue(true); mocks.send.mockResolvedValue({}); });
const checker = new ConnectionChecker();
const signal = () => AbortSignal.timeout(10000);
describe('verificadores externos somente leitura', () => {
  it('Pusher usa GET /channels, TLS em cluster e host/porta corretos no servidor próprio', async () => {
    await checker.check('pusher', { appId: 'app', key: 'public', cluster: 'sa1', mode: 'cluster' }, { secret: 'private' }, signal());
    expect(mocks.get).toHaveBeenCalledWith({ path: '/channels' });
    expect(mocks.pusher).toHaveBeenLastCalledWith(expect.objectContaining({ useTLS: true, cluster: 'sa1', timeout: 10000 }));
    await checker.check('pusher', { appId: 'app', key: 'public', url: 'http://soketi:6001', mode: 'host' }, { secret: 'private' }, signal());
    expect(mocks.pusher).toHaveBeenLastCalledWith(expect.objectContaining({ host: 'soketi', port: '6001', useTLS: false }));
    mocks.get.mockResolvedValue({ ok: false, status: 401 });
    await expect(checker.check('pusher', { mode: 'cluster' }, {}, signal())).rejects.toBeInstanceOf(CheckFailure);
  });
  it('SMTP verifica autenticação com TLS, sem enviar mensagem, e fecha em sucesso/falha', async () => {
    await checker.check('smtp', { host: 'smtp.example.test', port: 587, user: 'fixture' }, { password: 'private' }, signal());
    expect(mocks.smtp).toHaveBeenLastCalledWith(expect.objectContaining({ secure: false, requireTLS: true, logger: false, debug: false, connectionTimeout: 10000 }));
    expect(mocks.verify).toHaveBeenCalledOnce(); expect(mocks.close).toHaveBeenCalledOnce();
    mocks.verify.mockRejectedValue(new Error('fixture failure'));
    await expect(checker.check('smtp', { host: 'smtp.example.test', port: 465 }, {}, signal())).rejects.toThrow();
    expect(mocks.smtp).toHaveBeenLastCalledWith(expect.objectContaining({ secure: true, requireTLS: false, auth: undefined }));
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });
  it('S3 envia apenas HeadBucket, limita tentativas e destrói o cliente', async () => {
    const abortSignal = signal();
    await checker.check('storage_s3', { endpoint: 'https://storage.example.test', region: 'us-east-1', bucket: 'fixture' }, { accessKey: 'access', secretKey: 'private' }, abortSignal);
    expect(mocks.head).toHaveBeenCalledWith({ Bucket: 'fixture' });
    expect(mocks.s3).toHaveBeenCalledWith(expect.objectContaining({ forcePathStyle: true, maxAttempts: 1 }));
    expect(mocks.send).toHaveBeenCalledWith(expect.anything(), { abortSignal }); expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it('IA usa somente GET autenticado e não segue redirecionamentos', async () => {
    const fetch = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.includes('/api/info') ? { version: '2.0.0' } : { models: [] }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    await checker.check('ai_opencode', { baseUrl: 'http://opencode:4096' }, { password: 'private' }, signal());
    await checker.check('ai_gemini', {}, { apiKey: 'fixture-key' }, signal());
    await checker.check('ai_jev', {}, { apiKey: 'fixture-key' }, signal());
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['http://opencode:4096/api/info', 'https://generativelanguage.googleapis.com/v1beta/models', 'https://api.typesafe.ai/v1/models']);
    for (const [, options] of fetch.mock.calls) { expect(options).toMatchObject({ redirect: 'error', signal: expect.any(AbortSignal) }); expect(options.method).toBeUndefined(); }
  });
  it('não aceita página HTML ou contrato incompatível como OpenCode saudável', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } })));
    await expect(checker.check('ai_opencode', { baseUrl: 'http://opencode:4096' }, { password: 'private' }, signal())).rejects.toBeInstanceOf(CheckFailure);
  });
});
