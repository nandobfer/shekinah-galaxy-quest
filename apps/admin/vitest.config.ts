import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('.', import.meta.url)), plugins: [react()], test: { name: 'admin', environment: 'jsdom', include: ['src/**/__tests__/**/*.test.tsx'], setupFiles: ['./src/test-setup.ts'] } });
