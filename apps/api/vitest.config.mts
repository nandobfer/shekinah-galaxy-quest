import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: { name: 'api', environment: 'node', include: ['src/**/__tests__/**/*.test.ts'], fileParallelism: false, testTimeout: 30000, hookTimeout: 180000 },
});
