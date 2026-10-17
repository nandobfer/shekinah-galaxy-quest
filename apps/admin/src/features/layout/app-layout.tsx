import { useEffect, useId, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { AppSidebar } from './app-sidebar';
import { useSidebar } from './use-sidebar';
import { usePermissions } from '../users/hooks/usePermissions';
import { ViewAsBanner } from '../view-as/components/ViewAsBanner';
import { ViewAsSelector } from '../view-as/components/ViewAsSelector';

interface Props { name: string; logout: () => void; loggingOut: boolean; }
export function AppLayout({ name, logout, loggingOut }: Props) {
  const { pathname } = useLocation();
  const { realIsAdmin } = usePermissions();
  const sidebar = useSidebar();
  const reduce = useReducedMotion();
  const id = useId();
  const main = useRef<HTMLElement>(null);
  useEffect(() => { main.current?.focus(); }, [pathname]);
  const drawerOpen = !sidebar.isDesktop && sidebar.open;
  const node = <AppSidebar collapsed={sidebar.isDesktop} name={name} logout={logout} loggingOut={loggingOut} onNavigate={() => sidebar.setOpen(false)} onClose={sidebar.isDesktop ? undefined : sidebar.close} />;
  return <div className="flex h-dvh overflow-hidden bg-background">
    <a href="#app-content" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring">Pular para o conteúdo</a>
    {sidebar.isDesktop && node}
    <AnimatePresence>{drawerOpen && <>
      <motion.div aria-hidden onClick={sidebar.close} className="fixed inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div ref={sidebar.drawerRef} id={id} role="dialog" aria-modal="true" aria-label="Menu principal" className="fixed inset-y-0 left-0 z-50" initial={{ x: reduce ? 0 : -260 }} animate={{ x: 0 }} exit={{ x: reduce ? 0 : -260 }} transition={{ duration: 0.22, ease: 'easeOut' }}>{node}</motion.div>
    </>}</AnimatePresence>
    <div inert={drawerOpen} className="flex min-w-0 flex-1 flex-col">
      {realIsAdmin && <div className="flex h-12 shrink-0 items-center justify-end border-b border-border px-4"><ViewAsSelector /></div>}
      <ViewAsBanner />
      {!sidebar.isDesktop && <button ref={sidebar.buttonRef} type="button" onClick={() => sidebar.setOpen(true)} className="fixed left-3 top-3 z-30 rounded-md border border-border bg-card/90 p-2 text-muted-foreground shadow-lg backdrop-blur hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Abrir menu" aria-expanded={drawerOpen} aria-controls={id}><Menu className="h-5 w-5" /></button>}
      <motion.main ref={main} key={pathname} id="app-content" tabIndex={-1} initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} className={`relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 outline-none md:px-6 lg:px-8 ${!sidebar.isDesktop ? 'pt-16' : ''}`}><Outlet /></motion.main>
    </div>
  </div>;
}
