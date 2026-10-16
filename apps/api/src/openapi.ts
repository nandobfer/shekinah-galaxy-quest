import { z } from 'zod';
import { sessionSchema, errorSchema, integrationSchema, integrationPatchSchema, integrationHealthSchema, integrationLogSchema, cronStateSchema, integrationIdSchema } from '@shekinah/contracts';

const security = [{ sessionCookie: [] }];
const response = (schema: z.ZodType) => ({ description: 'Operação concluída', content: { 'application/json': { schema: z.toJSONSchema(schema) } } });
const failures = { '400': { description: 'Entrada inválida' }, '401': { description: 'Sessão inválida' }, '403': { description: 'Origem inválida ou sem X-Shekinah-Request: 1' }, '404': { description: 'Integração inexistente' }, '409': { description: 'Configuração concorrente, criptografia indisponível ou rotina em andamento' } };
const idParameter = { name: 'id', in: 'path', required: true, schema: z.toJSONSchema(integrationIdSchema) };
const mutationHeaders = [{ name: 'Origin', in: 'header', required: true, schema: { type: 'string' }, description: 'APP_ORIGIN exata' }, { name: 'X-Shekinah-Request', in: 'header', required: true, schema: { type: 'string', const: '1' } }];

export const openapi = {
  openapi: '3.1.0', info: { title: 'Shekinah API', version: '0.1.0' },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/integrations': { get: { summary: 'Listar integrações administrativas', security, responses: { '200': response(z.array(integrationSchema)), ...failures } } },
    '/integrations/{id}': {
      get: { summary: 'Configuração sem valores privados', security, parameters: [idParameter], responses: { '200': response(integrationSchema), ...failures } },
      patch: { summary: 'Salvar configuração (segredos somente escrita; versão obrigatória)', security, parameters: [idParameter, ...mutationHeaders], requestBody: { required: true, content: { 'application/json': { schema: z.toJSONSchema(integrationPatchSchema) } } }, responses: { '200': response(integrationSchema), ...failures } },
    },
    '/integrations/{id}/test': { post: { summary: 'Verificação sem envio de e-mail, geração de IA ou escrita de arquivos', security, parameters: [idParameter, ...mutationHeaders], responses: { '201': response(integrationHealthSchema), ...failures } } },
    '/integrations/{id}/logs': { get: { summary: 'Últimos 100 diagnósticos sanitizados (48h)', security, parameters: [idParameter], responses: { '200': response(z.array(integrationLogSchema)), ...failures } } },
    '/integrations/crons/jobs/{jobId}/run': { post: { summary: 'Executar rotina registrada com lease distribuído', security, parameters: [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string', enum: ['integrations-health-check'] } }, ...mutationHeaders], responses: { '201': response(cronStateSchema), ...failures } } },
    '/health': { get: { summary: 'Disponibilidade da API', responses: { '200': { description: 'API disponível' } } } },
    '/me': { get: { summary: 'Administrador autenticado', security: [{ sessionCookie: [] }], responses: {
      '200': { description: 'Sessão válida', content: { 'application/json': { schema: z.toJSONSchema(sessionSchema) } } },
      '401': { description: 'Sem sessão administrativa válida', content: { 'application/json': { schema: z.toJSONSchema(errorSchema) } } },
    } } },
  },
  components: { securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'authjs.session-token', description: 'Em HTTPS/produção: __Secure-authjs.session-token. Obtenha a sessão pelo protocolo Auth.js em /api/v1/auth; não envie bearer JWT.' } } },
};
