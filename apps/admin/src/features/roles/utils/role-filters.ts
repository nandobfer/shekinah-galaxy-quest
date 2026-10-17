import { urlFilterCodecs, type UrlFilterSchema } from '@/hooks/useUrlFilters';
export const ROLE_STATUS = ['ativo', 'inativo'] as const;
export type RoleStatus = (typeof ROLE_STATUS)[number];
export interface RoleFiltersValues { search: string; status: RoleStatus[]; }
export const DEFAULT_ROLE_FILTERS: RoleFiltersValues = { search: '', status: [] };
export const ROLE_FILTER_SCHEMA: UrlFilterSchema<RoleFiltersValues> = { search: urlFilterCodecs.string(), status: urlFilterCodecs.strings(ROLE_STATUS) };
