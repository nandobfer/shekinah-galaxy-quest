import { createBrowserRouter, RouterProvider, Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
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

function SessionRoutes() {
  const session = useSession();
  const logout = useMutation({ mutationFn: () => api.logout(), onSuccess: () => {
    queryClient.clear(); queryClient.setQueryData(sessionKey, null); toast.success('Você saiu com segurança.');
  }, onError: error => toast.error(error.message) });
  if (session.isPending) return <main className="page-shell" role="status">Verificando sua sessão…</main>;
  if (session.isError) return <main className="page-shell"><section className="space-y-4"><h1 className="text-2xl font-semibold">Não foi possível conectar</h1><p role="alert">Verifique sua conexão e tente novamente.</p><Button onClick={() => session.refetch()}>Tentar novamente</Button></section></main>;
  return <Routes>
    <Route path="/login" element={session.data ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route element={session.data ? <AppLayout name={session.data.user.name} logout={() => logout.mutate()} loggingOut={logout.isPending} /> : <Navigate to="/login" replace />}>
      <Route path="/" element={<HomePage name={session.data?.user.name ?? ''} />} />
      <Route path="/integracoes" element={<IntegrationList />} />
      <Route path="/integracoes/:integrationId" element={<IntegrationDetailPage />} />
      <Route path="/integracoes/ia/:providerId" element={<IntegrationDetailPage />} />
    </Route>
    <Route path="*" element={<Navigate to={session.data ? '/' : '/login'} replace />} />
  </Routes>;
}
export function App() {
  const [router] = useState(() => createBrowserRouter([{ path: '*', element: <SessionRoutes /> }]));
  return <MotionProvider><RouterProvider router={router} /><Toaster theme="dark" richColors position="top-right" /></MotionProvider>;
}
