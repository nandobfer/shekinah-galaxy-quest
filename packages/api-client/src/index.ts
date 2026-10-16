import axios from 'axios';
import { z } from 'zod';
import { loginSchema, sessionSchema, type LoginInput } from '@shekinah/contracts';

export class AuthError extends Error {
  constructor(public readonly code: 'credentials' | 'unavailable' | 'rate_limit' | 'session') {
    super({ credentials: 'E-mail ou senha inválidos.', unavailable: 'Não foi possível conectar. Tente novamente.', rate_limit: 'Muitas tentativas. Aguarde antes de tentar novamente.', session: 'Sua sessão expirou. Entre novamente.' }[code]);
  }
}

export function createApiClient(options: { baseURL?: string; onUnauthorized?: () => void } = {}) {
  const http = axios.create({ baseURL: options.baseURL ?? '/api/v1', timeout: 15000, withCredentials: true });
  http.interceptors.response.use(undefined, (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) options.onUnauthorized?.();
    return Promise.reject(error);
  });
  const csrf = async () => z.object({ csrfToken: z.string().min(1) }).parse((await http.get('/auth/csrf')).data).csrfToken;
  return {
    async session(signal?: AbortSignal) {
      try { return sessionSchema.parse((await http.get('/me', { signal })).data); }
      catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) return null;
        if (axios.isCancel(error)) throw error;
        throw new AuthError('unavailable');
      }
    },
    async login(input: LoginInput) {
      try {
        const data = loginSchema.parse(input);
        const body = new URLSearchParams({ ...data, csrfToken: await csrf(), callbackUrl: '/', json: 'true' });
        const response = await http.post('/auth/callback/credentials', body, { headers: { 'X-Auth-Return-Redirect': '1' } });
        const result = z.object({ url: z.string() }).parse(response.data);
        const url = new URL(result.url, 'http://localhost');
        if (url.searchParams.has('error')) throw new AuthError('credentials');
        const session = await this.session();
        if (!session) throw new AuthError('credentials');
        return session;
      } catch (error) {
        if (error instanceof AuthError) throw error;
        if (axios.isAxiosError(error) && error.response?.status === 429) throw new AuthError('rate_limit');
        throw new AuthError('unavailable');
      }
    },
    async logout() {
      try {
        await http.post('/auth/signout', new URLSearchParams({ csrfToken: await csrf(), callbackUrl: '/' }), { headers: { 'X-Auth-Return-Redirect': '1' } });
      } catch { throw new AuthError('unavailable'); }
    },
  };
}
