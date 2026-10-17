import { useMemo } from 'react';
import { useAdminUsers } from '@/features/users/hooks/useUsersAdmin';
import { usePermissions } from '@/features/users/hooks/usePermissions';

export function useRoleMemberOptions(roleId?: string) {
  const { can } = usePermissions();
  const query = useAdminUsers(can('users.view'));
  const usuarios = useMemo(() => (query.data ?? []).map(user => ({ _id: user.id, nome: user.nome, email: user.email, ativo: user.ativo, gerenciavel: user.gerenciavel })), [query.data]);
  const membrosAtuais = useMemo(() => (query.data ?? []).filter(user => roleId && user.roleIds.includes(roleId)).map(user => user.id), [query.data, roleId]);
  return { ...query, usuarios, membrosAtuais };
}
