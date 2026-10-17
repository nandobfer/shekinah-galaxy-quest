import { z } from 'zod';
import { sessionSchema, errorSchema, integrationSchema, integrationPatchSchema, integrationHealthSchema, integrationLogSchema, cronStateSchema, integrationIdSchema } from '@shekinah/contracts';
import { objectIdSchema, rolesResponseSchema, roleInputSchema, roleUpdateSchema, roleReorderSchema, roleMembersSchema, adminUserDtoSchema, assignableRoleSchema, effectiveRoleSchema, userAccessUpdateSchema, viewAsEventSchema } from '@shekinah/contracts';

const security = [{ sessionCookie: [] }];
const response = (schema: z.ZodType) => ({ description: 'Operação concluída', content: { 'application/json': { schema: z.toJSONSchema(schema) } } });
const failures = { '400': { description: 'Entrada inválida' }, '401': { description: 'Sessão inválida' }, '403': { description: 'Sem permissão, simulação inválida ou origem não autorizada' }, '404': { description: 'Registro inexistente' }, '409': { description: 'Versão concorrente, restrição de integridade ou rotina em andamento' }, '503': { description: 'Mutações de autoridade exigem MongoDB com replica set' } };
const idParameter = { name: 'id', in: 'path', required: true, schema: z.toJSONSchema(integrationIdSchema) };
const mutationHeaders = [{ name: 'Origin', in: 'header', required: true, schema: { type: 'string' }, description: 'APP_ORIGIN exata' }, { name: 'X-Shekinah-Request', in: 'header', required: true, schema: { type: 'string', const: '1' } }];
const viewAsHeader = { name: 'x-perfix-view-as', in: 'header', required: false, schema: { type: 'string' }, description: 'Payload encodeViewAs do Perfix; none desliga a simulação nesta requisição. Apenas administrador real pode simular.' };
const accessId = { name: 'id', in: 'path', required: true, schema: z.toJSONSchema(objectIdSchema) };
const versionQuery = { name: 'version', in: 'query', required: true, schema: { type: 'integer', minimum: 0 } };
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema: z.toJSONSchema(schema) } } });
const accessMutation = (summary: string, schema?: z.ZodType) => ({ summary, security, parameters: [viewAsHeader, ...mutationHeaders], ...(schema ? { requestBody: body(schema) } : {}), responses: { '200': { description: 'Operação concluída' }, ...failures } });

export const openapi = {
  openapi: '3.1.0', info: { title: 'Shekinah API', version: '0.1.0', description: 'Sessão Auth.js e autorização por perfis Perfix resolvida a cada requisição. Integrações usam integrations.<id>.view/edit/explore; execução manual global usa integrations.crons.run. Leitura desta documentação exige integrations.internal_api.view.' },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/roles': {
      get: { summary: 'Perfis, membros e versão da hierarquia (roles.view)', security, parameters: [viewAsHeader], responses: { '200': response(rolesResponseSchema), ...failures } },
      post: { ...accessMutation('Criar perfil sem coringa (roles.edit + administrador efetivo)', roleInputSchema), responses: { '201': response(z.object({ id: objectIdSchema })), ...failures } },
    },
    '/roles/{id}': {
      patch: { ...accessMutation('Editar perfil atomicamente; membros opcionais exigem também users.edit (roles.edit + administrador efetivo)', roleUpdateSchema), parameters: [accessId, viewAsHeader, ...mutationHeaders] },
      delete: { ...accessMutation('Excluir perfil sem membros, exceto Administrador (roles.edit)'), parameters: [accessId, versionQuery, viewAsHeader, ...mutationHeaders] },
    },
    '/roles/reorder': { put: accessMutation('Reordenar perfis gerenciáveis sem mover posições protegidas (roles.edit)', roleReorderSchema) },
    '/roles/{id}/members': { put: { ...accessMutation('Alterar membros com validação transacional (roles.edit + users.edit)', roleMembersSchema), parameters: [accessId, viewAsHeader, ...mutationHeaders] } },
    '/users': { get: { summary: 'Usuários existentes; não há cadastro por API (users.view)', security, parameters: [viewAsHeader], responses: { '200': response(z.array(adminUserDtoSchema)), ...failures } } },
    '/users/assignable-roles': { get: { summary: 'Perfis ativos e motivos de bloqueio (users.edit)', security, parameters: [viewAsHeader], responses: { '200': response(z.array(assignableRoleSchema)), ...failures } } },
    '/users/{id}': {
      patch: { ...accessMutation('Editar nome, status e atribuições (users.edit + hierarquia)', userAccessUpdateSchema), parameters: [accessId, viewAsHeader, ...mutationHeaders] },
      delete: { ...accessMutation('Excluir outro usuário gerenciável (users.edit + hierarquia)'), parameters: [accessId, versionQuery, viewAsHeader, ...mutationHeaders] },
    },
    '/view-as/roles': { get: { summary: 'Opções de simulação (administrador real)', security, parameters: [viewAsHeader], responses: { '200': response(z.array(effectiveRoleSchema)), ...failures } } },
    '/view-as/users': { get: { summary: 'Até 20 usuários ativos para simulação (administrador real)', security, parameters: [viewAsHeader, { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 } }], responses: { '200': response(z.array(adminUserDtoSchema.pick({ id: true, nome: true, email: true, cargos: true }))), ...failures } } },
    '/view-as/events': { post: { ...accessMutation('Auditar início, troca ou fim da simulação como autor real', viewAsEventSchema), responses: { '201': response(z.object({ ok: z.literal(true) })), ...failures } } },
    '/integrations': { get: { summary: 'Listar somente integrações permitidas', security, parameters: [viewAsHeader], responses: { '200': response(z.array(integrationSchema)), ...failures } } },
    '/integrations/{id}': {
      get: { summary: 'Configuração sem valores privados (integrations.<id>.view)', security, parameters: [idParameter, viewAsHeader], responses: { '200': response(integrationSchema), ...failures } },
      patch: { summary: 'Salvar configuração (integrations.<id>.edit; segredos somente escrita; versão obrigatória)', security, parameters: [idParameter, viewAsHeader, ...mutationHeaders], requestBody: { required: true, content: { 'application/json': { schema: z.toJSONSchema(integrationPatchSchema) } } }, responses: { '200': response(integrationSchema), ...failures } },
    },
    '/integrations/{id}/test': { post: { summary: 'Verificação sem envio de e-mail, geração de IA ou escrita de arquivos (integrations.<id>.explore)', security, parameters: [idParameter, viewAsHeader, ...mutationHeaders], responses: { '201': response(integrationHealthSchema), ...failures } } },
    '/integrations/{id}/logs': { get: { summary: 'Últimos 100 diagnósticos sanitizados (48h; integrations.<id>.explore)', security, parameters: [idParameter, viewAsHeader], responses: { '200': response(z.array(integrationLogSchema)), ...failures } } },
    '/integrations/crons/jobs/{jobId}/run': { post: { summary: 'Executar rotina registrada com lease distribuído (integrations.crons.run)', security, parameters: [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string', enum: ['integrations-health-check'] } }, viewAsHeader, ...mutationHeaders], responses: { '201': response(cronStateSchema), ...failures } } },
    '/health': { get: { summary: 'Disponibilidade da API', responses: { '200': { description: 'API disponível' } } } },
    '/me': { get: { summary: 'Identidade real e permissões efetivas', security: [{ sessionCookie: [] }], parameters: [viewAsHeader], responses: {
      '200': { description: 'Sessão válida', content: { 'application/json': { schema: z.toJSONSchema(sessionSchema) } } },
      '401': { description: 'Sem sessão administrativa válida', content: { 'application/json': { schema: z.toJSONSchema(errorSchema) } } },
    } } },
  },
  components: { securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'authjs.session-token', description: 'Em HTTPS/produção: __Secure-authjs.session-token. Obtenha a sessão pelo protocolo Auth.js em /api/v1/auth; não envie bearer JWT.' } } },
};
