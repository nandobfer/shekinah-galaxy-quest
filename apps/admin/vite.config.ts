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
      // Escuta em todas as interfaces IPv4 para permitir acesso por IP; a porta vem de PORT,
      // com ADMIN_PORT como fallback (mesma precedência publicada pelo Compose).
      host: '0.0.0.0', port: Number(env.PORT || env.ADMIN_PORT || 5180), strictPort: true,
      proxy: { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3010', changeOrigin: false } },
    },
  };
});
