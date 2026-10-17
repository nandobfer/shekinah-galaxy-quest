import type { ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';

export function AccessDenied() {
  return <section role="alert" className="rounded-xl border border-border bg-card p-6"><h1 className="text-lg font-semibold">Sem acesso</h1><p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para acessar esta página. Solicite acesso a um administrador.</p></section>;
}
export function RequireAccess({ permission, any, administrator = false, children }: { permission?: string; any?: string[]; administrator?: boolean; children: ReactNode }) {
  const { can, canAny, isAdministrator } = usePermissions();
  return (!permission || can(permission)) && (!any || canAny(any)) && (!administrator || isAdministrator) ? children : <AccessDenied />;
}
