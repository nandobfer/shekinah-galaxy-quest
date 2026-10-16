import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MotionProvider } from '../components/motion/MotionProvider';
import { Toaster } from '../components/ui/toast';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { LoginPage } from '../features/auth/login-page';
import { api, queryClient, sessionKey, useSession } from '../features/auth/session';

function SessionRoutes() {
  const session = useSession();
  const logout = useMutation({ mutationFn: () => api.logout(), onSuccess: () => {
    queryClient.clear(); queryClient.setQueryData(sessionKey, null); toast.success('Você saiu com segurança.');
  }, onError: error => toast.error(error.message) });
  if (session.isPending) return <main className="page-shell" role="status">Verificando sua sessão…</main>;
  if (session.isError) return <main className="page-shell"><section className="space-y-4"><h1 className="text-2xl font-semibold">Não foi possível conectar</h1><p role="alert">Verifique sua conexão e tente novamente.</p><Button onClick={() => session.refetch()}>Tentar novamente</Button></section></main>;
  return <Routes>
    <Route path="/login" element={session.data ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route path="/" element={session.data ? <main className="page-shell"><section className="w-full max-w-lg space-y-5 rounded-3xl border border-border bg-card p-8">
      <ShieldCheck className="text-primary" size={32} aria-hidden="true" />
      <h1 className="text-2xl font-semibold">Olá, {session.data.user.name}.</h1>
      <p className="text-muted-foreground">Sua sessão administrativa está ativa.</p>
      <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={18} aria-hidden="true" />{logout.isPending ? 'Saindo…' : 'Sair'}</Button>
    </section></main> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to={session.data ? '/' : '/login'} replace />} />
  </Routes>;
}
export function App() {
  return <MotionProvider><BrowserRouter><SessionRoutes /></BrowserRouter><Toaster theme="dark" richColors position="top-right" /></MotionProvider>;
}
