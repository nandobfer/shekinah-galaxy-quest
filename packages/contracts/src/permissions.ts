import { z } from 'zod';
import { defineCatalog, WILDCARD, type PermissionBranchDef } from '@nandobfer/perfix';
import { INTEGRATIONS } from './integrations.js';

export { WILDCARD };
export const PERMISSION_TREE = [
  { id: 'usuarios', label: 'Usuários', viewKey: 'users.view', children: [
    { key: 'users.view', label: 'Visualizar usuários' }, { key: 'users.edit', label: 'Administrar usuários e atribuir perfis', sensitive: true },
  ] },
  { id: 'perfis', label: 'Perfis', viewKey: 'roles.view', children: [
    { key: 'roles.view', label: 'Visualizar perfis' }, { key: 'roles.edit', label: 'Administrar perfis e permissões', sensitive: true },
  ] },
  { id: 'integracoes', label: 'Integrações', children: INTEGRATIONS.map(integration => ({
    id: `integration_${integration.id}`, label: integration.name, viewKey: `integrations.${integration.id}.view`, children: [
      { key: `integrations.${integration.id}.view`, label: 'Visualizar' },
      { key: `integrations.${integration.id}.edit`, label: 'Configurar', sensitive: true },
      { key: `integrations.${integration.id}.explore`, label: 'Testar conexão e consultar logs de debug', sensitive: true },
      ...(integration.id === 'crons' ? [{ key: 'integrations.crons.run', label: 'Executar rotinas manualmente', sensitive: true }] : []),
    ],
  })) },
] as const satisfies readonly PermissionBranchDef[];
export const catalog = defineCatalog(PERMISSION_TREE);
export const COLOR_TOKENS = ['vermelho', 'laranja', 'ambar', 'amarelo', 'lima', 'verde', 'esmeralda', 'turquesa', 'ciano', 'celeste', 'azul', 'indigo', 'violeta', 'roxo', 'magenta', 'rosa', 'rubi', 'cinza'] as const;
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'ID inválido.');
const ids = z.array(objectIdSchema).max(500).refine(values => new Set(values).size === values.length, 'IDs repetidos.');
export const roleInputSchema = z.strictObject({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(60), descricao: z.string().trim().max(500),
  cor: z.enum(COLOR_TOKENS), ativo: z.boolean(), escopos: z.array(z.never()).max(0),
  permissoes: z.array(z.string().refine((key): boolean => key === WILDCARD || catalog.isKnownKey(key), 'Permissão desconhecida.')).max(200),
});
export const roleUpdateSchema = roleInputSchema.partial().extend({ version: z.number().int().nonnegative(), membros: ids.optional() }).strict();
export const roleReorderSchema = z.strictObject({ ordem: ids.min(2), version: z.number().int().nonnegative() });
export const roleMembersSchema = z.strictObject({ membros: ids, version: z.number().int().nonnegative() });
export const userAccessUpdateSchema = z.strictObject({
  nome: z.string().trim().min(2).max(100), ativo: z.boolean(), cargos: ids, version: z.number().int().nonnegative(),
});
export const effectiveRoleSchema = z.object({ id: z.string(), slug: z.string(), nome: z.string(), cor: z.string(), permissoes: z.array(z.string()), ativo: z.boolean(), posicao: z.number(), escopos: z.array(z.never()) });
export const roleDtoSchema = effectiveRoleSchema.extend({
  _id: z.string(), slug: z.string(), descricao: z.string(), version: z.number().int(), usuariosCount: z.number().int(), membros: z.array(z.string()),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), createdBy: z.string().optional(), updatedBy: z.string().optional(), createdByNome: z.string().optional(), updatedByNome: z.string().optional(),
});
export const adminUserDtoSchema = z.object({
  id: z.string(), nome: z.string(), email: z.email(), ativo: z.boolean(), version: z.number().int(),
  cargos: z.array(effectiveRoleSchema), roleIds: z.array(z.string()), gerenciavel: z.boolean(),
});
export const assignableRoleSchema = effectiveRoleSchema.extend({ descricao: z.string(), bloqueado: z.boolean(), motivo: z.string().optional() });
export const accessSchema = z.object({
  permissions: z.array(z.string()), roles: z.array(effectiveRoleSchema), realIsAdministrator: z.boolean(),
  simulation: z.object({ tipo: z.enum(['cargo', 'usuario']), alvoId: z.string(), alvoNome: z.string() }).nullable(),
});
export const rolesResponseSchema = z.object({ roles: z.array(roleDtoSchema), total: z.number(), hierarchyVersion: z.number().int() });
export const viewAsSchema = z.discriminatedUnion('tipo', [z.strictObject({ tipo: z.literal('cargo'), roleId: objectIdSchema }), z.strictObject({ tipo: z.literal('usuario'), userId: objectIdSchema })]);
export const viewAsEventSchema = z.strictObject({ kind: z.enum(['inicio', 'troca', 'fim']), previous: viewAsSchema.nullable(), next: viewAsSchema.nullable() });
export type RoleInput = z.infer<typeof roleInputSchema>;
export type RoleDto = z.infer<typeof roleDtoSchema>;
export type AdminUserDto = z.infer<typeof adminUserDtoSchema>;
export type Access = z.infer<typeof accessSchema>;
