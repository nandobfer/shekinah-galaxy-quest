import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '');
  return {
    envDir: '../..', plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: Number(env.ADMIN_PORT || 5180), strictPort: true,
      proxy: { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3010', changeOrigin: false } },
    },
  };
});
