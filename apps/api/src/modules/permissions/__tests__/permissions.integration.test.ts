import 'reflect-metadata';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { Types } from 'mongoose';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { encodeViewAs } from '@nandobfer/perfix';
import { rolesResponseSchema, sessionSchema } from '@shekinah/contracts';
import { createApp } from '../../../bootstrap.js';
import { readConfig } from '../../../config.js';
import { UsersService } from '../../users/users.service.js';
import { ConnectionChecker } from '../../integrations/connection-checker.js';
import { AccessService } from '../access.service.js';
import { migrateLegacyAccess } from '../../../../../../scripts/helpers/migrate-legacy-access.js';

const origin = 'http://localhost:5180';
const password = 'fixture-password-perfix-123';
let mongo: MongoMemoryReplSet;
let app: INestApplication;
let access: AccessService;
let root: string;
let adminId: string;
let passwordHash: string;
let client: ReturnType<typeof request.agent>;
let sequence = 0;
const input = (nome = 'Leitura', permissoes = ['integrations.pusher.view']) => ({ nome, descricao: '', cor: 'roxo', ativo: true, permissoes, escopos: [] });
async function login(email: string) {
  const agent = request.agent(app.getHttpServer());
  const csrf = await agent.get('/api/v1/auth/csrf');
  await agent.post('/api/v1/auth/callback/credentials').set('Origin', origin).set('X-Auth-Return-Redirect', '1').type('form').send({ email, password, csrfToken: csrf.body.csrfToken }).expect(200);
  return agent;
}
function mutation(agent: typeof client, method: 'post' | 'patch' | 'put' | 'delete', path: string) {
  return agent[method](`/api/v1/${path}`).set('Origin', origin).set('X-Shekinah-Request', '1');
}
async function profile(permissoes = ['integrations.pusher.view'], ativo = true) {
  sequence++;
  return access.roles.create({ ...input(`Perfil ${sequence}`, permissoes), slug: `perfil-${sequence}`, ativo });
}
async function account(roleIds: string[], active = true) {
  sequence++;
  return access.users.create({ name: `Usuário ${sequence}`, email: `fixture-${sequence}@example.test`, role: 'admin', roles: roleIds, passwordHash, active });
}
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ binary: { version: '8.0.18' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  app = await createApp(readConfig({ MONGODB_URI: mongo.getUri('shekinah_perfix_test'), AUTH_SECRET: 'fixture-perfix-secret-not-production-123456', APP_ORIGIN: origin, NODE_ENV: 'test', LOG_LEVEL: 'silent', LOGIN_RATE_LIMIT: '1000' }));
  await app.listen(0, '127.0.0.1');
  vi.spyOn(app.get(ConnectionChecker), 'check').mockResolvedValue('Conexão de teste.');
  access = app.get(AccessService);
  root = (await app.get(UsersService).createAdmin({ name: 'Administrador real', email: 'root@example.test', password })).id;
  const operator = await access.users.findById(root).select('+passwordHash').orFail();
  adminId = operator.roles[0]!; passwordHash = operator.passwordHash;
  client = await login('root@example.test');
});
afterAll(async () => { await app?.close(); await mongo?.stop(); });
beforeEach(async () => {
  await access.users.deleteMany({ _id: { $ne: root } });
  await access.users.updateOne({ _id: root }, { $set: { roles: [adminId], active: true, accessVersion: 0, sessionVersion: 0 } });
  await access.roles.deleteMany({ _id: { $ne: adminId } });
  await access.roles.updateOne({ _id: adminId }, { $set: { nome: 'Administrador', cor: 'vermelho', version: 0 } });
  await access.states.updateOne({ _id: 'global' }, { $set: { ordem: [adminId], version: 0, fence: 0 } }, { upsert: true });
  await access.audits.deleteMany({});
});

describe('Perfix: autenticação separada da autorização', () => {
  it('protege APIs de perfis, usuários e opções, sem criar cadastro', async () => {
    for (const path of ['roles', 'users', 'view-as/roles', 'view-as/users']) await request(app.getHttpServer()).get(`/api/v1/${path}`).expect(401);
    await mutation(client, 'post', 'users').send({}).expect(404);
    await client.post('/api/v1/roles').send(input()).expect(403);
    await client.post('/api/v1/roles').set('Origin', 'https://evil.test').set('X-Shekinah-Request', '1').send(input()).expect(403);
  });
  it('conta sem perfil pode autenticar mas não administra nada; não recebe coringa por role legado', async () => {
    const user = await account([]); const agent = await login(user.email);
    const me = sessionSchema.parse((await agent.get('/api/v1/me').expect(200)).body);
    expect(me.access).toMatchObject({ permissions: [], realIsAdministrator: false });
    for (const path of ['roles', 'users', 'integrations/pusher', 'integrations/pusher/logs', 'openapi.json']) await agent.get(`/api/v1/${path}`).expect(403);
    expect((await agent.get('/api/v1/integrations').expect(200)).body).toEqual([]);
    await mutation(agent, 'patch', 'integrations/pusher').send({}).expect(403);
    await mutation(agent, 'post', 'integrations/pusher/test').expect(403);
    await mutation(agent, 'post', 'integrations/crons/jobs/integrations-health-check/run').expect(403);
  });
  it('filtra integrações, bloqueia escrita e aplica revogação sem trocar JWT', async () => {
    const role = await profile(); const user = await account([role.id as string]); const agent = await login(user.email);
    expect((await agent.get('/api/v1/integrations').expect(200)).body.map((item: { id: string }) => item.id)).toEqual(['pusher']);
    await agent.get('/api/v1/integrations/pusher').expect(200);
    await agent.get('/api/v1/integrations/smtp').expect(403);
    await mutation(agent, 'patch', 'integrations/pusher').send({}).expect(403);
    await access.roles.updateOne({ _id: role._id }, { $set: { ativo: false } });
    await agent.get('/api/v1/integrations/pusher').expect(403);
    expect(sessionSchema.parse((await agent.get('/api/v1/me').expect(200)).body).access?.permissions).toEqual([]);
  });
  it('não consulta provedores via teste agregado de IA sem permissão em todos eles', async () => {
    const role = await profile(['integrations.ai.view', 'integrations.ai.explore']); const user = await account([role.id as string]);
    await mutation(await login(user.email), 'post', 'integrations/ai/test').expect(403);
  });
});

describe('Perfix: perfis, concorrência e atribuições', () => {
  it('cria perfil com dependências, contrato público e auditoria sem documentos ou hashes', async () => {
    const response = await mutation(client, 'post', 'roles').send(input('Operador', ['integrations.smtp.edit'])).expect(201);
    const roles = rolesResponseSchema.parse((await client.get('/api/v1/roles').expect(200)).body);
    expect(roles.roles.find(role => role.id === response.body.id)?.permissoes).toEqual(expect.arrayContaining(['integrations.smtp.view', 'integrations.smtp.edit']));
    expect(await access.audits.countDocuments({ actorId: root, action: 'role.create', targetId: response.body.id })).toBe(1);
    expect(JSON.stringify(roles)).not.toMatch(/passwordHash|sessionVersion|__v/);
  });
  it('rejeita coringa, escopos customizados, permissões desconhecidas e nome duplicado', async () => {
    await mutation(client, 'post', 'roles').send(input('Irrestrito', ['*'])).expect(403);
    await mutation(client, 'post', 'roles').send({ ...input(), escopos: ['empresa:1'] }).expect(400);
    await mutation(client, 'post', 'roles').send(input('Desconhecido', ['inventado.view'])).expect(400);
    await mutation(client, 'post', 'roles').send(input('Leitura')).expect(201);
    await mutation(client, 'post', 'roles').send(input('Leitura')).expect(409);
  });
  it('não permite que roles.edit conceda criação ou alterações sem coringa', async () => {
    const role = await profile(['roles.view', 'roles.edit']); const user = await account([role.id as string]); const agent = await login(user.email);
    await agent.get('/api/v1/roles').expect(200);
    await mutation(agent, 'post', 'roles').send(input('Escalada', ['users.edit'])).expect(403);
    await mutation(agent, 'patch', `roles/${role.id as string}`).send({ version: 0, permissoes: ['*'] }).expect(403);
  });
  it('protege Administrador e permite somente identidade visual', async () => {
    for (const patch of [{ ativo: false }, { permissoes: [] }, { escopos: [] }]) await mutation(client, 'patch', `roles/${adminId}`).send({ version: 0, ...patch }).expect(403);
    await mutation(client, 'delete', `roles/${adminId}?version=0`).expect(403);
    await mutation(client, 'patch', `roles/${adminId}`).send({ version: 0, nome: 'Admin principal', cor: 'azul' }).expect(200);
    expect((await access.roles.findById(adminId).orFail()).permissoes).toEqual(['*']);
  });
  it('somente uma edição concorrente vence e a outra retorna conflito', async () => {
    const role = await profile();
    const results = await Promise.all(['Primeiro', 'Segundo'].map(nome => mutation(client, 'patch', `roles/${role.id as string}`).send({ version: 0, nome })));
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(await access.audits.countDocuments({ action: 'role.update', targetId: role.id })).toBe(1);
  });
  it('reordena apenas posições gerenciáveis, com versão e sem mover Administrador', async () => {
    const a = await profile(); const b = await profile();
    await mutation(client, 'put', 'roles/reorder').send({ ordem: [b.id, a.id], version: 0 }).expect(200);
    const roles = rolesResponseSchema.parse((await client.get('/api/v1/roles')).body);
    expect(roles.roles.map(role => role.id)).toEqual([adminId, b.id, a.id]);
    await mutation(client, 'put', 'roles/reorder').send({ ordem: [a.id, b.id], version: 0 }).expect(409);
    await mutation(client, 'put', 'roles/reorder').send({ ordem: [a.id, adminId], version: 1 }).expect(403);
  });
  it('impede autodesativação, alteração dos próprios perfis e autoexclusão', async () => {
    await mutation(client, 'patch', `users/${root}`).send({ nome: 'Admin', ativo: false, cargos: [adminId], version: 0 }).expect(403);
    await mutation(client, 'patch', `users/${root}`).send({ nome: 'Admin', ativo: true, cargos: [], version: 0 }).expect(403);
    await mutation(client, 'delete', `users/${root}?version=0`).expect(403);
  });
  it('duas desativações concorrentes não removem todos os administradores', async () => {
    const other = await account([adminId]); const agent = await login(other.email);
    const results = await Promise.all([
      mutation(client, 'patch', `users/${other.id as string}`).send({ nome: other.name, ativo: false, cargos: [adminId], version: 0 }),
      mutation(agent, 'patch', `users/${root}`).send({ nome: 'Administrador real', ativo: false, cargos: [adminId], version: 0 }),
    ]);
    expect(results.filter(result => result.status === 200)).toHaveLength(1);
    expect(await access.users.countDocuments({ active: true, roles: adminId })).toBe(1);
  });
  it('atribui múltiplos perfis, protege conta superior e respeita o piso de chaves sensíveis', async () => {
    const manager = await profile(['users.view', 'users.edit', 'integrations.pusher.view']);
    const low = await profile(); const strong = await profile(['integrations.smtp.view', 'integrations.smtp.edit']);
    await access.states.updateOne({ _id: 'global' }, { $set: { ordem: [adminId, manager.id, low.id, strong.id] } });
    const caller = await account([manager.id as string]); const target = await account([low.id as string]); const agent = await login(caller.email);
    const body = { nome: target.name, ativo: true, cargos: [low.id, strong.id], version: 0 };
    await mutation(agent, 'patch', `users/${target.id as string}`).send(body).expect(403);
    await mutation(agent, 'patch', `users/${root}`).send({ ...body, cargos: [adminId] }).expect(403);
    await mutation(client, 'patch', `users/${target.id as string}`).send(body).expect(200);
    expect((await access.users.findById(target.id).orFail()).roles).toEqual([low.id, strong.id]);
  });
  it('membros de perfil são atômicos, removem sessão efetiva e impedem exclusão referenciada', async () => {
    const role = await profile(); const user = await account([]);
    await mutation(client, 'put', `roles/${role.id as string}/members`).send({ membros: [user.id], version: 0 }).expect(200);
    await mutation(client, 'delete', `roles/${role.id as string}?version=1`).expect(409);
    const agent = await login(user.email); await agent.get('/api/v1/integrations/pusher').expect(200);
    await mutation(client, 'put', `roles/${role.id as string}/members`).send({ membros: [], version: 1 }).expect(200);
    await agent.get('/api/v1/integrations/pusher').expect(403);
    await mutation(client, 'delete', `roles/${role.id as string}?version=2`).expect(200);
  });
  it('salva identidade e membros na mesma transação e desfaz tudo se a atribuição falhar', async () => {
    const role = await profile(); const user = await account([]);
    await mutation(client, 'patch', `roles/${role.id as string}`).send({ version: 0, nome: 'Não salvar', membros: [root] }).expect(403);
    expect((await access.roles.findById(role.id).orFail()).nome).toBe(role.nome);
    expect(await access.audits.countDocuments({ targetId: role.id })).toBe(0);
    await mutation(client, 'patch', `roles/${role.id as string}`).send({ version: 0, nome: 'Atômico', membros: [user.id] }).expect(200);
    expect((await access.roles.findById(role.id).orFail())).toMatchObject({ nome: 'Atômico', version: 1 });
    expect((await access.users.findById(user.id).orFail()).roles).toEqual([role.id]);
  });
});

describe('Perfix: simulação validada no servidor', () => {
  it('não eleva usuário comum via payload forjado e não faz fallback em payload inválido', async () => {
    const user = await account([]); const agent = await login(user.email);
    await agent.get('/api/v1/me').set('x-perfix-view-as', encodeViewAs({ tipo: 'cargo', roleId: adminId })).expect(403);
    await agent.get('/api/v1/view-as/roles').set('x-perfix-view-as', 'none').expect(403);
    await client.get('/api/v1/me').set('x-perfix-view-as', 'payload-invalido').expect(403);
    await client.get('/api/v1/me').set('x-perfix-view-as', encodeViewAs({ tipo: 'cargo', roleId: new Types.ObjectId().toString() })).expect(403);
  });
  it('aplica perfil limitado sem trocar identidade real, valida alvo e audita ações como ator real', async () => {
    const role = await profile(['integrations.pusher.view', 'integrations.pusher.edit']);
    const header = encodeViewAs({ tipo: 'cargo', roleId: role.id as string });
    const me = sessionSchema.parse((await client.get('/api/v1/me').set('x-perfix-view-as', header).expect(200)).body);
    expect(me.user.id).toBe(root); expect(me.access).toMatchObject({ realIsAdministrator: true, simulation: { tipo: 'cargo', alvoId: role.id } });
    expect(me.access?.permissions).not.toContain('*');
    await client.get('/api/v1/users').set('x-perfix-view-as', header).expect(403);
    await mutation(client, 'patch', 'integrations/pusher').set('x-perfix-view-as', header).send({ version: 0, environment: 'externo', debugMode: false, publicValues: {}, secrets: {} }).expect(200);
    const persisted = await access.connection.db!.collection('integrations').findOne({ id: 'pusher' });
    expect(persisted?.audit.at(-1)).toMatchObject({ actor: root, simulation: { tipo: 'cargo', alvoId: role.id } });
    await mutation(client, 'post', 'view-as/events').set('x-perfix-view-as', 'none').send({ kind: 'inicio', previous: null, next: { tipo: 'cargo', roleId: role.id } }).expect(201);
    expect(await access.audits.countDocuments({ action: 'view-as.inicio', actorId: root })).toBe(1);
    await access.roles.updateOne({ _id: role._id }, { $set: { ativo: false } });
    await client.get('/api/v1/me').set('x-perfix-view-as', header).expect(403);
  });
  it('simula união de perfis de usuário e perde acesso ao alvo desativado', async () => {
    const a = await profile(); const b = await profile(['roles.view']); const user = await account([a.id as string, b.id as string]);
    const header = encodeViewAs({ tipo: 'usuario', userId: user.id as string });
    const me = sessionSchema.parse((await client.get('/api/v1/me').set('x-perfix-view-as', header).expect(200)).body);
    expect(me.access?.permissions).toEqual(expect.arrayContaining(['roles.view', 'integrations.pusher.view']));
    expect(me.user.id).toBe(root);
    await access.users.updateOne({ _id: user._id }, { $set: { active: false } });
    await client.get('/api/v1/me').set('x-perfix-view-as', header).expect(403);
  });
});

describe('migração de legado é explícita e idempotente', () => {
  it('não concede automaticamente, mantém inativos e não restaura permissões removidas intencionalmente', async () => {
    const legacy = await access.connection.db!.collection('users').insertOne({ name: 'Legado', email: 'legacy@example.test', passwordHash, role: 'admin', active: false, sessionVersion: 0, createdAt: new Date(), updatedAt: new Date() });
    const intentional = await account([]);
    expect(await migrateLegacyAccess(access.connection)).toEqual({ eligible: 1, migrated: 0 });
    expect((await access.users.findById(legacy.insertedId).orFail()).roles).toEqual([]);
    expect(await migrateLegacyAccess(access.connection, true)).toEqual({ eligible: 1, migrated: 1 });
    expect((await access.users.findById(legacy.insertedId).orFail())).toMatchObject({ active: false, roles: [adminId], accessVersion: 1 });
    expect((await access.users.findById(intentional.id).orFail()).roles).toEqual([]);
    expect(await migrateLegacyAccess(access.connection, true)).toEqual({ eligible: 0, migrated: 0 });
    expect(await access.audits.countDocuments({ action: 'access.migrate', actorId: 'operator-cli' })).toBe(1);
  });
});
