import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { projects: ['apps/api/vitest.config.mts', 'apps/admin/vitest.config.ts', 'packages/contracts/vitest.config.ts', 'packages/api-client/vitest.config.ts', { test: { name: 'scripts', environment: 'node', include: ['scripts/**/__tests__/**/*.test.ts'] } }] } });
