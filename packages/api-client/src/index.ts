import axios from 'axios';
import { z } from 'zod';
import { loginSchema, sessionSchema, integrationSchema, integrationPatchSchema, integrationHealthSchema, integrationLogSchema, cronStateSchema, type IntegrationId, type IntegrationPatch, type LoginInput } from '@shekinah/contracts';

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
  const mutationHeaders = { 'X-Shekinah-Request': '1' };
  async function integrationRequest<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error) {
      if (axios.isCancel(error)) throw error;
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) throw new AuthError('session');
        const body = z.object({ message: z.string().max(300) }).safeParse(error.response?.data);
        if (body.success && error.response && error.response.status < 500) throw new Error(body.data.message);
      }
      throw new Error('Não foi possível concluir a operação. Verifique sua conexão e tente novamente.');
    }
  }
  return {
    integrations: {
      list: (signal?: AbortSignal) => integrationRequest(async () => z.array(integrationSchema).parse((await http.get('/integrations', { signal })).data)),
      detail: (id: IntegrationId, signal?: AbortSignal) => integrationRequest(async () => integrationSchema.parse((await http.get(`/integrations/${id}`, { signal })).data)),
      save: (id: IntegrationId, input: IntegrationPatch) => integrationRequest(async () => integrationSchema.parse((await http.patch(`/integrations/${id}`, integrationPatchSchema.parse(input), { headers: mutationHeaders })).data)),
      test: (id: IntegrationId) => integrationRequest(async () => integrationHealthSchema.parse((await http.post(`/integrations/${id}/test`, {}, { headers: mutationHeaders, timeout: 20000 })).data)),
      logs: (id: IntegrationId, signal?: AbortSignal) => integrationRequest(async () => z.array(integrationLogSchema).parse((await http.get(`/integrations/${id}/logs`, { signal })).data)),
      runHealthCheck: () => integrationRequest(async () => cronStateSchema.parse((await http.post('/integrations/crons/jobs/integrations-health-check/run', {}, { headers: mutationHeaders, timeout: 30000 })).data)),
    },
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
