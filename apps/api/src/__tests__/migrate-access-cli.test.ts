import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { createConnection, type Connection } from 'mongoose';

/**
 * Standalone topology (no replica set) is the common operator setup. The migration must refuse
 * before writing anything AND say why, instead of the generic "verifique a conexão" message.
 */
let mongo: MongoMemoryServer;
let connection: Connection;
let uri: string;
const repository = resolve(import.meta.dirname, '../../../..');
const run = (...args: string[]) => spawnSync('pnpm', ['exec', 'tsx', 'scripts/migrate-access.ts', ...args], {
  cwd: repository, env: { ...process.env, MONGODB_URI: uri }, encoding: 'utf8', timeout: 30000,
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '8.0.18' }, instance: { dbName: 'shekinah_migration_cli_test' } });
  uri = mongo.getUri('shekinah_migration_cli_test');
  connection = createConnection(uri, { serverSelectionTimeoutMS: 5000 });
  await connection.asPromise();
  await connection.db!.collection('users').insertOne({ name: 'Legado', email: 'legacy@example.test', passwordHash: '$argon2id$fixture', role: 'admin', active: true, sessionVersion: 0, createdAt: new Date(), updatedAt: new Date() });
});
afterAll(async () => { await connection?.close(); await mongo?.stop(); });

describe('migração de acessos por CLI em MongoDB standalone', () => {
  it('informa a topologia standalone na simulação e não promete uma migração inviável', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 conta(s) elegível(is)');
    expect(result.stderr).toContain('standalone');
    expect(result.stderr).toContain('replica set');
  });
  it('recusa --apply com o motivo real e mantém o banco intacto', async () => {
    const result = run('--apply');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('replica set');
    expect(result.stderr).toContain('rs.initiate()');
    expect(result.stderr).not.toContain('Verifique os argumentos e a conexão');
    expect(`${result.stdout}${result.stderr}`).not.toContain(uri);
    const legacy = await connection.db!.collection('users').findOne({ email: 'legacy@example.test' });
    expect(legacy).toMatchObject({ role: 'admin' });
    expect(legacy?.accessVersion).toBeUndefined();
    expect(legacy?.roles ?? []).toEqual([]);
    expect(await connection.db!.collection('access_audit').countDocuments({ action: 'access.migrate' })).toBe(0);
  });
});
