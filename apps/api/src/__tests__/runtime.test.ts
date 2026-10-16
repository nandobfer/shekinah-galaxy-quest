import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server-core';

describe('runtime NestJS via tsx, sem build', () => {
  it('inicia pelo entrypoint real e atende health e guard', async () => {
    const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.18' }, instance: { dbName: 'runtime_test' } });
    const reservation = createServer();
    await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const address = reservation.address();
    if (!address || typeof address === 'string') throw new Error('Não foi possível reservar porta de teste');
    const port = address.port;
    await new Promise<void>(resolve => reservation.close(() => resolve()));
    const require = createRequire(import.meta.url);
    const child = spawn(process.execPath, [require.resolve('tsx/cli'), 'src/main.ts'], {
      cwd: resolve(import.meta.dirname, '../..'),
      env: { ...process.env, MONGODB_URI: mongo.getUri(), AUTH_SECRET: 'runtime-test-only-secret-at-least-32-characters', APP_ORIGIN: 'http://localhost:5180', API_PORT: String(port), NODE_ENV: 'test', LOG_LEVEL: 'silent' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += String(chunk); });
    child.stderr.on('data', chunk => { output += String(chunk); });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error(`Runtime encerrou antes do startup: ${output}`);
        try {
          const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
          if (response.ok) { expect(await response.json()).toEqual({ status: 'ok' }); ready = true; break; }
        } catch { /* Startup bounded by test timeout; no external service is used. */ }
        await setTimeout(100);
      }
      expect(ready, output).toBe(true);
      expect((await fetch(`http://127.0.0.1:${port}/api/v1/me`)).status).toBe(401);
    } finally {
      if (child.exitCode === null) {
        const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
        child.kill('SIGTERM');
        await Promise.race([exited, setTimeout(3000)]);
        if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
      }
      await mongo.stop();
    }
  });
});
