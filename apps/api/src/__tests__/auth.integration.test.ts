import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { verify } from '@node-rs/argon2';
import { encode } from '@auth/core/jwt';
import type { INestApplication } from '@nestjs/common';
import { sessionSchema } from '@shekinah/contracts';
import { createApp } from '../bootstrap.js';
import { readConfig } from '../config.js';
import { DuplicateAdminError, UsersService } from '../modules/users/users.service.js';
import type { User } from '../modules/users/user.schema.js';

const origin = 'http://localhost:5180';
const credentials = { name: 'Operador de teste', email: 'admin@example.test', password: 'test-only-long-password-123' };
let mongo: MongoMemoryServer;
let app: INestApplication;
let users: UsersService;
let model: Model<User>;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '8.0.18' }, instance: { dbName: 'shekinah_auth_test' } });
  app = await createApp(readConfig({ MONGODB_URI: mongo.getUri(), AUTH_SECRET: 'test-only-not-for-production-secret-123456', APP_ORIGIN: origin, NODE_ENV: 'test', LOG_LEVEL: 'silent', LOGIN_RATE_LIMIT: '100' }));
  await app.listen(0, '127.0.0.1');
  users = app.get(UsersService);
  model = app.get<Model<User>>(getModelToken('User'));
});
afterAll(async () => { await app?.close(); await mongo?.stop(); });
beforeEach(async () => { await model.deleteMany({}); await users.createAdmin(credentials); });

function agent() { return request.agent(app.getHttpServer()); }
async function csrf(client: ReturnType<typeof agent>) {
  const response = await client.get('/api/v1/auth/csrf').expect(200);
  return response.body.csrfToken as string;
}
async function login(client: ReturnType<typeof agent>, password = credentials.password) {
  const csrfToken = await csrf(client);
  return client.post('/api/v1/auth/callback/credentials').set('Origin', origin).set('X-Auth-Return-Redirect', '1').type('form')
    .send({ email: credentials.email, password, csrfToken, callbackUrl: '/' });
}

describe('criação de administradores com MongoDB real isolado', () => {
  it('normaliza e-mail e persiste somente hash Argon2id', async () => {
    const created = await users.createAdmin({ ...credentials, email: '  OUTRO@EXAMPLE.TEST  ' });
    expect(created.email).toBe('outro@example.test');
    expect(created).not.toHaveProperty('passwordHash');
    const persisted = await model.findById(created.id).select('+passwordHash').orFail();
    expect(persisted.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verify(persisted.passwordHash, credentials.password)).toBe(true);
    expect((await model.findById(created.id).orFail()).passwordHash).toBeUndefined();
  });
  it('não redefine nem duplica conta existente', async () => {
    const before = await model.findOne({ email: credentials.email }).select('+passwordHash').orFail();
    await expect(users.createAdmin({ ...credentials, email: 'ADMIN@EXAMPLE.TEST', password: 'different-password-123' })).rejects.toBeInstanceOf(DuplicateAdminError);
    expect(await model.countDocuments()).toBe(1);
    expect((await model.findById(before.id).select('+passwordHash').orFail()).passwordHash).toBe(before.passwordHash);
  });
  it('garante unicidade em duas criações concorrentes', async () => {
    const results = await Promise.allSettled([users.createAdmin({ ...credentials, email: 'race@example.test' }), users.createAdmin({ ...credentials, email: 'RACE@example.test' })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await model.countDocuments({ email: 'race@example.test' })).toBe(1);
  });
  it('recusa senha fraca antes de persistir', async () => {
    await expect(users.createAdmin({ ...credentials, email: 'weak@example.test', password: '123' })).rejects.toThrow();
    expect(await model.countDocuments({ email: 'weak@example.test' })).toBe(0);
  });
});

describe('Auth.js real integrado ao NestJS', () => {
  it('protege /me e publica o contrato OpenAPI', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/me').expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    const spec = await request(app.getHttpServer()).get('/api/v1/openapi.json').expect(200);
    expect(spec.body.paths['/me'].get.responses['200']).toBeDefined();
  });
  it('autentica, emite cookie HttpOnly e retorna o contrato sem hash', async () => {
    const client = agent();
    const response = await login(client);
    expect(response.status).toBe(200);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.some(cookie => cookie.includes('authjs.session-token=') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax'))).toBe(true);
    const me = await client.get('/api/v1/me').expect(200);
    expect(sessionSchema.parse(me.body).user.email).toBe(credentials.email);
    expect(JSON.stringify(me.body)).not.toContain('password');
    expect(JSON.stringify(me.body)).not.toContain('sessionVersion');
  });
  it('não revela se conta existe ou senha está incorreta', async () => {
    const client = agent();
    const wrong = await login(client, 'wrong-password');
    expect(new URL(wrong.body.url).searchParams.get('error')).toBe('CredentialsSignin');
    await client.get('/api/v1/me').expect(401);
    const csrfToken = await csrf(client);
    const unknown = await client.post('/api/v1/auth/callback/credentials').set('Origin', origin).set('X-Auth-Return-Redirect', '1').type('form')
      .send({ email: 'missing@example.test', password: credentials.password, csrfToken });
    expect(new URL(unknown.body.url).searchParams.get('error')).toBe('CredentialsSignin');
  });
  it('recusa login inativo e invalida sessão após desativação', async () => {
    const client = agent();
    await login(client);
    await model.updateOne({ email: credentials.email }, { $set: { active: false } });
    await client.get('/api/v1/me').expect(401);
    const response = await login(agent());
    expect(new URL(response.body.url).searchParams.get('error')).toBe('CredentialsSignin');
  });
  it('invalida sessão com versão alterada e não aceita papel não administrativo', async () => {
    const client = agent(); await login(client);
    await model.updateOne({ email: credentials.email }, { $inc: { sessionVersion: 1 } });
    await client.get('/api/v1/me').expect(401);
    // Simula um documento legado/corrompido, não uma nova regra de domínio.
    await model.collection.updateOne({ email: credentials.email }, { $set: { role: 'member' } });
    expect(new URL((await login(agent())).body.url).searchParams.get('error')).toBe('CredentialsSignin');
  });
  it('recusa origem externa e não permite bypass de CSRF', async () => {
    const client = agent();
    await client.post('/api/v1/auth/callback/credentials').set('Origin', 'https://evil.example').type('form').send(credentials).expect(403);
    const response = await client.post('/api/v1/auth/callback/credentials').set('Origin', origin).set('X-Auth-Return-Redirect', '1').type('form').send(credentials);
    expect(response.status).toBe(200);
    expect(new URL(response.body.url).searchParams.get('error')).toBeTruthy();
    await client.get('/api/v1/me').expect(401);
  });
  it('não aceita cookie adulterado nem bearer token arbitrário', async () => {
    await request(app.getHttpServer()).get('/api/v1/me').set('Cookie', 'authjs.session-token=invalid').expect(401);
    await request(app.getHttpServer()).get('/api/v1/me').set('Authorization', 'Bearer invalid').expect(401);
  });
  it('rejeita sessão criptografada já expirada', async () => {
    const user = await model.findOne({ email: credentials.email }).orFail();
    const token = await encode({ secret: 'test-only-not-for-production-secret-123456', salt: 'authjs.session-token', token: { sub: user.id, sessionVersion: 0 }, maxAge: -120 });
    await request(app.getHttpServer()).get('/api/v1/me').set('Cookie', `authjs.session-token=${token}`).expect(401);
  });
  it('logout revoga também a segunda sessão e limpa cookie', async () => {
    const first = agent(); const second = agent();
    await login(first); await login(second);
    await second.get('/api/v1/me').expect(200);
    const csrfToken = await csrf(first);
    const response = await first.post('/api/v1/auth/signout').set('Origin', origin).set('X-Auth-Return-Redirect', '1').type('form').send({ csrfToken, callbackUrl: '/' }).expect(200);
    expect((response.headers['set-cookie'] as unknown as string[]).some(cookie => cookie.includes('authjs.session-token=;'))).toBe(true);
    await first.get('/api/v1/me').expect(401);
    await second.get('/api/v1/me').expect(401);
  });
  it('limita tentativas de login no bridge real', async () => {
    const limited = await createApp(readConfig({ MONGODB_URI: mongo.getUri(), AUTH_SECRET: 'test-only-not-for-production-secret-123456', APP_ORIGIN: origin, NODE_ENV: 'test', LOG_LEVEL: 'silent', LOGIN_RATE_LIMIT: '1' }));
    try {
      await limited.listen(0, '127.0.0.1');
      const client = request.agent(limited.getHttpServer());
      await login(client, 'invalid');
      const response = await login(client, 'invalid');
      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMITED');
    } finally { await limited.close(); }
  });
});
