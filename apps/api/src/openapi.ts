import { z } from 'zod';
import { sessionSchema, errorSchema } from '@shekinah/contracts';

export const openapi = {
  openapi: '3.1.0', info: { title: 'Shekinah API', version: '0.1.0' },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/health': { get: { summary: 'Disponibilidade da API', responses: { '200': { description: 'API disponível' } } } },
    '/me': { get: { summary: 'Administrador autenticado', security: [{ sessionCookie: [] }], responses: {
      '200': { description: 'Sessão válida', content: { 'application/json': { schema: z.toJSONSchema(sessionSchema) } } },
      '401': { description: 'Sem sessão administrativa válida', content: { 'application/json': { schema: z.toJSONSchema(errorSchema) } } },
    } } },
  },
  components: { securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'authjs.session-token', description: 'Em HTTPS/produção: __Secure-authjs.session-token. Obtenha a sessão pelo protocolo Auth.js em /api/v1/auth; não envie bearer JWT.' } } },
};
