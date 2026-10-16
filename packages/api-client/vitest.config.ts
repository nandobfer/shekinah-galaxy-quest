import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('.', import.meta.url)), test: { name: 'api-client', include: ['src/**/__tests__/**/*.test.ts'] } });
