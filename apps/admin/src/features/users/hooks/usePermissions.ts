import { usePermissions as usePerfix } from '@nandobfer/perfix/react';
import { useSession } from '@/features/auth/session';

export function usePermissions() {
  const permissions = usePerfix();
  const { data } = useSession();
  return { ...permissions, cargos: permissions.roles, isAdministrator: permissions.isAdmin, userId: data?.user.id ?? null };
}
