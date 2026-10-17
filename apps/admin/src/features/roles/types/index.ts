export type { RoleDto as IRole } from '@shekinah/contracts';
export interface GetRolesParams { search?: string; ativo?: boolean; }
export interface RoleMemberOption { _id: string; nome: string; email: string; ativo: boolean; gerenciavel: boolean; }
