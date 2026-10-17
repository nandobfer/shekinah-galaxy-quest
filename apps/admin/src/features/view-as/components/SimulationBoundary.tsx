import { useEffect, type ReactNode } from 'react';
import { ViewAsProvider, useViewAs } from '@nandobfer/perfix/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, queryClient, sessionKey } from '@/features/auth/session';
function InvalidSimulation() {
  const { stop } = useViewAs();
  useEffect(() => {
    const invalid = () => { stop(); toast.error('A simulação não está mais disponível. Seu acesso real foi restaurado.'); };
    window.addEventListener('perfix:invalid', invalid);
    return () => window.removeEventListener('perfix:invalid', invalid);
  }, [stop]);
  return null;
}
export function SimulationBoundary({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return <ViewAsProvider onChange={({ kind, previous, next }) => {
    const signedIn = !!queryClient.getQueryData(sessionKey);
    void queryClient.cancelQueries();
    queryClient.clear();
    navigate('/', { replace: true });
    if (signedIn) void api.permissions.viewEvent({ kind, previous: previous?.viewAs ?? null, next: next?.viewAs ?? null }).catch(error => toast.error(error.message));
  }}><InvalidSimulation />{children}</ViewAsProvider>;
}
