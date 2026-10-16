import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { projects: ['apps/api/vitest.config.mts', 'apps/admin/vitest.config.ts', 'packages/contracts/vitest.config.ts', 'packages/api-client/vitest.config.ts'] } });
