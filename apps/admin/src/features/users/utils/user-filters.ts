import { urlFilterCodecs, type UrlFilterSchema } from '@/hooks/useUrlFilters';
import type { AdminUserDto } from '@shekinah/contracts';
export type UserStatus = 'ativo' | 'inativo';
export interface UserFiltersValues { search: string; perfis: string[]; status: UserStatus[]; }
export const DEFAULT_USER_FILTERS: UserFiltersValues = { search: '', perfis: [], status: [] };
export const USER_FILTER_SCHEMA: UrlFilterSchema<UserFiltersValues> = { search: urlFilterCodecs.string(), perfis: urlFilterCodecs.strings(), status: urlFilterCodecs.strings(['ativo', 'inativo']) };
export function filterUsers(users: AdminUserDto[], filters: UserFiltersValues) {
  const term = filters.search.trim().toLocaleLowerCase('pt-BR');
  return users.filter(user => (!term || `${user.nome} ${user.email}`.toLocaleLowerCase('pt-BR').includes(term)) &&
    (!filters.perfis.length || user.roleIds.some(id => filters.perfis.includes(id))) && (!filters.status.length || filters.status.includes(user.ativo ? 'ativo' : 'inativo')));
}
export function profileOptions(users: AdminUserDto[]) { return [...new Map(users.flatMap(user => user.cargos.map(role => [role.id, { value: role.id, label: role.nome }] as const))).values()]; }
