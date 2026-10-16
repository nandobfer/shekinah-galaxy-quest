import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('script administrativo', () => {
  it('recusa pipe antes de conectar ao banco ou criar contas', () => {
    const result = spawnSync('pnpm', ['exec', 'tsx', 'scripts/create-admin.ts'], {
      cwd: resolve(import.meta.dirname, '../../../..'),
      env: { ...process.env, MONGODB_URI: 'mongodb://127.0.0.1:1/never_connect' },
      input: '', encoding: 'utf8', timeout: 15000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('terminal interativo');
    expect(result.stderr).not.toContain('never_connect');
  });
});
