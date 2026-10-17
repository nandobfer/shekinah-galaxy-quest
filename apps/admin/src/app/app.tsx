import { createBrowserRouter, RouterProvider, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MotionProvider } from '../components/motion/MotionProvider';
import { Toaster } from '../components/ui/toast';
import { Button } from '../components/ui/button';
import { LoginPage } from '../features/auth/login-page';
import { api, queryClient, sessionKey, useSession } from '../features/auth/session';
import { AppLayout } from '../features/layout/app-layout';
import { HomePage } from '../features/home/home-page';
import { IntegrationList } from '../features/integrations/integration-list';
import { IntegrationDetailPage } from '../features/integrations/integration-detail-page';
import { PermissionsProvider, useViewAs } from '@nandobfer/perfix/react';
import { INTEGRATIONS } from '@shekinah/contracts';
import { SimulationBoundary } from '../features/view-as/components/SimulationBoundary';
import { RequireAccess } from '../features/users/components/RequireAccess';
import { UserList } from '../features/users/components/UserList';
import { RoleList } from '../features/roles/components/RoleList';
import { RoleFormPage } from '../features/roles/components/RoleFormPage';

function SessionRoutes() {
  const session = useSession();
  const { stop } = useViewAs();
  useEffect(() => { if (session.data === null) stop(); }, [session.data, stop]);
  const logout = useMutation({ mutationFn: () => api.logout(), onSuccess: () => {
    queryClient.clear(); queryClient.setQueryData(sessionKey, null); toast.success('Você saiu com segurança.');
  }, onError: error => toast.error(error.message) });
  if (session.isPending) return <main className="page-shell" role="status">Verificando sua sessão…</main>;
  if (session.isError) return <main className="page-shell"><section className="space-y-4"><h1 className="text-2xl font-semibold">Não foi possível conectar</h1><p role="alert">Verifique sua conexão e tente novamente.</p><Button onClick={() => session.refetch()}>Tentar novamente</Button></section></main>;
  return <PermissionsProvider permissions={session.data?.access?.permissions} roles={session.data?.access?.roles} realIsAdmin={session.data?.access?.realIsAdministrator ?? false}><Routes>
    <Route path="/login" element={session.data ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route element={session.data ? <AppLayout name={session.data.user.name} logout={() => logout.mutate()} loggingOut={logout.isPending} /> : <Navigate to="/login" replace />}>
      <Route path="/" element={<HomePage name={session.data?.user.name ?? ''} />} />
      <Route path="/usuarios" element={<RequireAccess permission="users.view"><UserList /></RequireAccess>} />
      <Route path="/perfis" element={<RequireAccess permission="roles.view"><RoleList /></RequireAccess>} />
      <Route path="/perfis/novo" element={<RequireAccess permission="roles.edit" administrator><RoleFormPage create /></RequireAccess>} />
      <Route path="/perfis/:roleId" element={<RequireAccess permission="roles.view"><RoleFormPage /></RequireAccess>} />
      <Route path="/integracoes" element={<RequireAccess any={INTEGRATIONS.map(integration => `integrations.${integration.id}.view`)}><IntegrationList /></RequireAccess>} />
      <Route path="/integracoes/:integrationId" element={<IntegrationDetailPage />} />
      <Route path="/integracoes/ia/:providerId" element={<IntegrationDetailPage />} />
    </Route>
    <Route path="*" element={<Navigate to={session.data ? '/' : '/login'} replace />} />
  </Routes></PermissionsProvider>;
}
export function App() {
  const [router] = useState(() => createBrowserRouter([{ path: '*', element: <SimulationBoundary><SessionRoutes /></SimulationBoundary> }]));
  return <MotionProvider><RouterProvider router={router} /><Toaster theme="dark" richColors position="top-right" /></MotionProvider>;
}
