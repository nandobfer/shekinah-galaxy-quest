import 'reflect-metadata';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { HEALTH_CHECK_JOB_ID, integrationSchema } from '@shekinah/contracts';
import { createApp } from '../../../bootstrap.js';
import { readConfig, type AppConfig } from '../../../config.js';
import { UsersService } from '../../users/users.service.js';
import { IntegrationsService } from '../integrations.service.js';
import { CronService } from '../cron.service.js';
import { ConnectionChecker } from '../connection-checker.js';
import type { DebugRecord, IntegrationRecord, CronRecord } from '../integration.schema.js';

const origin = 'http://localhost:5180';
const secret = 'fixture-integration-secret-never-log';
let app: INestApplication;
let mongo: MongoMemoryServer;
let config: AppConfig;
let service: IntegrationsService;
let cron: CronService;
let records: Model<IntegrationRecord>;
let states: Model<CronRecord>;
let client: ReturnType<typeof request.agent>;
const probe = vi.fn<ConnectionChecker['check']>();
const patch = (version = 0) => ({ version, environment: 'externo', debugMode: true, publicValues: { appId: 'fixture', key: 'public-fixture-key', mode: 'cluster', cluster: 'sa1' }, secrets: { secret: { action: 'set', value: secret } } });
beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '8.0.18' }, instance: { dbName: 'shekinah_integrations_test' } });
  config = readConfig({ MONGODB_URI: mongo.getUri(), AUTH_SECRET: 'fixture-only-not-a-production-secret-123456', INTEGRATIONS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), APP_ORIGIN: origin, NODE_ENV: 'test', LOG_LEVEL: 'silent', LOGIN_RATE_LIMIT: '100' });
  app = await createApp(config); await app.listen(0, '127.0.0.1');
  await app.get(UsersService).createAdmin({ name: 'Operador', email: 'integrations@example.test', password: 'fixture-admin-password-123' });
  service = app.get(IntegrationsService); cron = app.get(CronService);
  records = app.get(getModelToken('IntegrationRecord')); states = app.get(getModelToken('CronRecord'));
  vi.spyOn(app.get(ConnectionChecker), 'check').mockImplementation((...args) => probe(...args));
  client = request.agent(app.getHttpServer());
  const csrf = await client.get('/api/v1/auth/csrf');
  await client.post('/api/v1/auth/callback/credentials').set('Origin', origin).set('X-Auth-Return-Redirect', '1').type('form')
    .send({ email: 'integrations@example.test', password: 'fixture-admin-password-123', csrfToken: csrf.body.csrfToken }).expect(200);
});
afterAll(async () => { await app?.close(); await mongo?.stop(); });
beforeEach(async () => {
  await records.deleteMany({});
  await app.get<Model<DebugRecord>>(getModelToken('IntegrationDebug')).deleteMany({});
  await states.updateOne({ id: HEALTH_CHECK_JOB_ID }, { $set: { lockedUntil: null, lockedBy: null, scheduleVersion: -1, nextRunAt: null, lastStatus: null, lastRunAt: null, lastFinishedAt: null, message: null } });
  probe.mockReset().mockResolvedValue('Conexão de teste válida.');
});
const mutation = (path: string) => client.post(`/api/v1/${path}`).set('Origin', origin).set('X-Shekinah-Request', '1');

describe('integrações: autorização, contratos e segredos', () => {
  it('recusa mutações de autoridade em standalone sem aplicar alteração', async () => {
    const response = await client.post('/api/v1/roles').set('Origin', origin).set('X-Shekinah-Request', '1').send({ nome: 'Teste standalone', descricao: '', cor: 'roxo', ativo: true, permissoes: [], escopos: [] }).expect(503);
    expect(response.body.message).toContain('replica set');
    expect((await client.get('/api/v1/roles')).body.roles).toHaveLength(1);
  });
  it('protege leitura, OpenAPI, logs, edição, testes e execução manual', async () => {
    const anonymous = request(app.getHttpServer());
    for (const path of ['integrations', 'integrations/pusher', 'integrations/pusher/logs', 'openapi.json']) await anonymous.get(`/api/v1/${path}`).expect(401);
    await anonymous.patch('/api/v1/integrations/pusher').send(patch()).expect(401);
    await anonymous.post('/api/v1/integrations/pusher/test').expect(401);
    await anonymous.post(`/api/v1/integrations/crons/jobs/${HEALTH_CHECK_JOB_ID}/run`).expect(401);
    await client.patch('/api/v1/integrations/pusher').send(patch()).expect(403);
    await client.patch('/api/v1/integrations/pusher').set('Origin', 'https://evil.example').set('X-Shekinah-Request', '1').send(patch()).expect(403);
    await client.post('/api/v1/integrations/pusher/test').set('Origin', origin).expect(403);
  });
  it('lista apenas seis raízes e três provedores com DTO sem documentos Mongoose', async () => {
    const response = await client.get('/api/v1/integrations').expect(200);
    const list = response.body.map((item: unknown) => integrationSchema.parse(item));
    expect(list.filter((item: { parent?: string }) => !item.parent)).toHaveLength(6);
    expect(list).toHaveLength(9);
    expect(JSON.stringify(response.body)).not.toContain('ciphertext');
    const crons = list.find((item: { id: string }) => item.id === 'crons');
    expect(crons.publicValues).toMatchObject({ schedulerEnabled: false, jobEnabled: false, intervalMinutes: 5 });
    await client.get('/api/v1/integrations/unknown').expect(404);
  });
  it('cifra segredos com IV novo, não devolve valores e audita só nomes de campos', async () => {
    const response = await client.patch('/api/v1/integrations/pusher').set('Origin', origin).set('X-Shekinah-Request', '1').send(patch()).expect(200);
    expect(response.body.secrets.secret).toEqual({ configured: true, unreadable: false });
    expect(JSON.stringify(response.body)).not.toContain(secret);
    const persisted = await records.findOne({ id: 'pusher' }).select('+secrets +audit').orFail().lean();
    expect(persisted.secrets.secret!.ciphertext).toBeTruthy();
    expect(JSON.stringify(persisted)).not.toContain(secret);
    expect(persisted.audit[0]?.fields).toContain('secret');
    expect((await service.resolved('pusher')).secrets.secret).toBe(secret);
    await service.save('pusher', patch(1), 'operator');
    const second = await records.findOne({ id: 'pusher' }).select('+secrets').orFail().lean();
    expect(second.secrets.secret!.iv).not.toBe(persisted.secrets.secret!.iv);
  });
  it('mantém segredos omitidos e permite remover sem devolver valor', async () => {
    await service.save('pusher', patch(), 'operator');
    await service.save('pusher', { ...patch(1), secrets: {}, publicValues: { cluster: 'eu' } }, 'operator');
    expect((await service.resolved('pusher')).secrets.secret).toBe(secret);
    const removed = await service.save('pusher', { ...patch(2), secrets: { secret: { action: 'clear' } } }, 'operator');
    expect(removed.secrets.secret?.configured).toBe(false);
    expect(removed.configured).toBe(false);
  });
  it('recusa escrita sem chave e sinaliza chave trocada sem vazar ou reutilizar segredo', async () => {
    const debug = app.get<Model<DebugRecord>>(getModelToken('IntegrationDebug'));
    const missing = new IntegrationsService(records, debug, records.db, { ...config, INTEGRATIONS_ENCRYPTION_KEY: undefined }, app.get(ConnectionChecker));
    await expect(missing.save('pusher', patch(), 'operator')).rejects.toMatchObject({ status: 409 });
    await service.save('pusher', patch(), 'operator');
    const rotated = new IntegrationsService(records, debug, records.db, { ...config, INTEGRATIONS_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64') }, app.get(ConnectionChecker));
    const dto = await rotated.detail('pusher');
    expect(dto.configured).toBe(false); expect(dto.secrets.secret).toEqual({ configured: true, unreadable: true });
    expect(JSON.stringify(dto)).not.toContain(secret);
    expect((await rotated.check('pusher', 'manual', 'operator')).state).toBe('not_configured');
    expect(probe).not.toHaveBeenCalled();
  });
  it('agrega provedores no hub e invalida saúde ao mudar configuração de um filho', async () => {
    await service.save('ai_gemini', { version: 0, environment: 'externo', debugMode: false, publicValues: {}, secrets: { apiKey: { action: 'set', value: secret } } }, 'operator');
    expect((await service.detail('ai')).health.state).toBe('unknown');
    await service.check('ai', 'manual', 'operator');
    expect((await service.detail('ai')).health.state).toBe('ok');
    await service.save('ai_gemini', { version: 1, environment: 'externo', debugMode: true, publicValues: {}, secrets: {} }, 'operator');
    expect((await service.detail('ai')).health.state).toBe('unknown');
    expect(probe).toHaveBeenCalledTimes(1);
  });
  it('rejeita campos inesperados, URLs com credenciais, tipos e versões inválidas', async () => {
    for (const body of [{ ...patch(), publicValues: { password: secret } }, { ...patch(), secrets: { token: { action: 'set', value: secret } } },
      { ...patch(), publicValues: { url: 'http://user:password@localhost' } }, { ...patch(), extra: true }, { ...patch(), publicValues: { mode: 'other' } }]) {
      await expect(service.save('pusher', body, 'operator')).rejects.toMatchObject({ status: 400 });
    }
    await service.save('pusher', patch(), 'operator');
    await expect(service.save('pusher', patch(), 'operator')).rejects.toMatchObject({ status: 409 });
  });
  it('garante índice único e somente um vencedor de duas edições concorrentes', async () => {
    const results = await Promise.allSettled([service.save('pusher', patch(), 'one'), service.save('pusher', patch(), 'two')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await records.countDocuments({ id: 'pusher' })).toBe(1);
  });
  it('retorna não configurada sem rede e sanitiza erros de SDK em saúde/logs', async () => {
    expect((await service.check('pusher', 'manual', 'operator')).state).toBe('not_configured');
    expect(probe).not.toHaveBeenCalled();
    await service.save('pusher', patch(), 'operator');
    probe.mockRejectedValue(new Error(`sensitive URL https://example.test?token=${secret}`));
    const health = await service.check('pusher', 'manual', 'operator');
    expect(health.state).toBe('error');
    const logs = await service.logs('pusher');
    expect(logs).toHaveLength(1); expect(JSON.stringify([health, logs])).not.toContain(secret);
    expect((await service.detail('pusher')).health.state).toBe('error');
  });
  it('não permite um probe antigo sobrescrever uma configuração nova', async () => {
    await service.save('pusher', patch(), 'operator');
    let release!: (value: string) => void;
    probe.mockImplementation(() => new Promise<string>(resolve => { release = resolve; }));
    const checking = service.check('pusher', 'manual', 'operator');
    await vi.waitFor(() => expect(probe).toHaveBeenCalled());
    await service.save('pusher', patch(1), 'operator'); release('Conectado');
    await expect(checking).rejects.toMatchObject({ status: 409 });
    expect((await service.detail('pusher')).health.state).toBe('unknown');
  });
  it('verifica API interna pelo próprio Nest e documenta todos os endpoints novos', async () => {
    expect((await mutation('integrations/internal_api/test').send({}).expect(201)).body.state).toBe('ok');
    const spec = await client.get('/api/v1/openapi.json').expect(200);
    expect(spec.body.paths['/integrations/{id}'].patch.requestBody).toBeDefined();
    expect(spec.body.paths['/integrations/crons/jobs/{jobId}/run']).toBeDefined();
  });
});

describe('cron de status com lease distribuído real no MongoDB', () => {
  it('não executa periodicidade desativada, mas permite disparo manual', async () => {
    await cron.run(false, 'scheduler'); expect(probe).not.toHaveBeenCalled();
    const result = await mutation(`integrations/crons/jobs/${HEALTH_CHECK_JOB_ID}/run`).send({}).expect(201);
    expect(result.body.lastStatus).toBe('ok'); expect(result.body.nextRunAt).toBeNull();
    expect((await records.findOne({ id: 'crons' }))?.health).toBeUndefined();
  });
  it('isola falha, não faz recursão em Crons e conserva o diagnóstico das outras integrações', async () => {
    await service.save('pusher', patch(), 'operator'); probe.mockRejectedValue(new Error('remote error'));
    const state = await cron.run(true, 'operator');
    expect(state.lastStatus).toBe('error'); expect(state.running).toBe(false);
    expect((await service.detail('internal_api')).health.state).toBe('ok');
    expect((await service.detail('smtp')).health.state).toBe('not_configured');
    expect(probe).toHaveBeenCalledTimes(1);
  });
  it('impede sobreposição manual e periódica entre duas instâncias', async () => {
    await service.save('pusher', patch(), 'operator');
    let release!: (value: string) => void;
    probe.mockImplementation(() => new Promise<string>(resolve => { release = resolve; }));
    const second = new CronService(states, service, config);
    const first = cron.run(true, 'operator');
    await vi.waitFor(() => expect(probe).toHaveBeenCalled());
    await expect(second.run(true, 'other')).rejects.toMatchObject({ status: 409 });
    await second.run(false, 'scheduler'); expect(probe).toHaveBeenCalledTimes(1);
    release('Conectado'); await first;
    expect((await cron.state()).running).toBe(false);
  });
  it('agenda primeira execução no futuro, recalcula na edição e ignora backlog ao religar', async () => {
    await service.save('crons', { version: 0, environment: 'interno', debugMode: false, secrets: {}, publicValues: { schedulerEnabled: true, jobEnabled: true, intervalMinutes: 5 } }, 'operator');
    const now = new Date(); await cron.sync(now);
    expect((await cron.state()).nextRunAt).toBe(new Date(now.getTime() + 300000).toISOString());
    await cron.run(false, 'scheduler', now); expect((await cron.state()).lastRunAt).toBeNull();
    await cron.run(false, 'scheduler', new Date(now.getTime() + 300001));
    expect((await cron.state()).lastStatus).toBe('ok');
    await service.save('crons', { version: 1, environment: 'interno', debugMode: false, secrets: {}, publicValues: { schedulerEnabled: false } }, 'operator');
    await cron.sync(); expect((await cron.state()).nextRunAt).toBeNull();
    await service.save('crons', { version: 2, environment: 'interno', debugMode: false, secrets: {}, publicValues: { schedulerEnabled: true, intervalMinutes: 10 } }, 'operator');
    await cron.sync(now); expect((await cron.state()).nextRunAt).toBe(new Date(now.getTime() + 600000).toISOString());
  });
  it('recupera lease expirado e recusa rotina não registrada', async () => {
    await states.updateOne({ id: HEALTH_CHECK_JOB_ID }, { $set: { lockedUntil: new Date(Date.now() - 1), lockedBy: 'dead-process' } });
    expect((await cron.run(true, 'operator')).lastStatus).toBe('ok');
    await mutation('integrations/crons/jobs/other/run').send({}).expect(400);
  });
});
