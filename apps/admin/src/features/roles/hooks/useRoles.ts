import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/features/auth/session';
import { type RoleInput, type RoleDto, type roleUpdateSchema } from '@shekinah/contracts';
import type { z } from 'zod';
import type { GetRolesParams } from '../types';

export const rolesKey = ['roles'] as const;
export function useRoles(params?: GetRolesParams) {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: rolesKey, queryFn: ({ signal }) => api.permissions.roles(signal) });
  const invalidate = async () => {
    await Promise.all([rolesKey, ['admin-users'], ['assignable-roles'], ['auth', 'session'], ['view-as']].map(queryKey => cache.invalidateQueries({ queryKey })));
  };
  const version = (id: string) => {
    const role = cache.getQueryData<{ roles: RoleDto[] }>(rolesKey)?.roles.find(role => role.id === id);
    if (!role) throw new Error('Recarregue os perfis antes de salvar.');
    return role.version;
  };
  const createRole = useMutation({ mutationFn: (data: RoleInput) => api.permissions.createRole(data), onSuccess: invalidate });
  const updateRole = useMutation({ mutationFn: ({ id, data, version: expected }: { id: string; data: Omit<z.infer<typeof roleUpdateSchema>, 'version'>; version: number }) => api.permissions.updateRole(id, { ...data, version: expected }), onSuccess: invalidate });
  const deleteRole = useMutation({ mutationFn: (id: string) => api.permissions.deleteRole(id, version(id)), onSuccess: invalidate });
  const updateMembers = useMutation({ mutationFn: ({ id, membros, version: expected }: { id: string; membros: string[]; version: number }) => api.permissions.members(id, { membros, version: expected }), onSuccess: invalidate });
  const reorderRoles = useMutation({ mutationFn: (ordem: string[]) => {
    const current = cache.getQueryData<{ hierarchyVersion: number }>(rolesKey);
    if (!current) throw new Error('Recarregue a hierarquia antes de salvar.');
    return api.permissions.reorder({ ordem, version: current.hierarchyVersion });
  }, onSuccess: invalidate });
  const roles = useMemo(() => query.data?.roles.filter(role =>
    (params?.ativo === undefined || role.ativo === params.ativo) &&
    (!params?.search || `${role.nome} ${role.descricao}`.toLocaleLowerCase('pt-BR').includes(params.search.toLocaleLowerCase('pt-BR'))),
  ), [query.data, params?.ativo, params?.search]);
  return { ...query, roles, createRole, updateRole, deleteRole, updateMembers, reorderRoles };
}
export function useRole(id?: string) {
  const query = useRoles();
  return { ...query, data: id ? query.data?.roles.find(role => role.id === id) : undefined };
}
