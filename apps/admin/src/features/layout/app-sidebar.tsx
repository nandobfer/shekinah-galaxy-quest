import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LogOut, Sparkles, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { APP_NAV, isActiveHref } from './navigation';
import { version } from '../../../../../package.json';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/80';
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? `${parts[0]![0]}${parts.length > 1 ? parts.at(-1)![0] : ''}`.toUpperCase() : '?';
}
interface SidebarProps { collapsed: boolean; name: string; onNavigate: () => void; onClose?: () => void; logout: () => void; loggingOut: boolean; }
/** Port of Opex AppSidebar: 68px desktop rail, 240px drawer, same item/owner anatomy. */
export function AppSidebar({ collapsed, name, onNavigate, onClose, logout, loggingOut }: SidebarProps) {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const logoutButton = <Button variant="ghost" className="w-full justify-start" onClick={logout} disabled={loggingOut}><LogOut className="h-4 w-4" />{loggingOut ? 'Saindo…' : 'Sair'}</Button>;
  return <motion.aside animate={{ width: collapsed ? 68 : 240 }} transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }} className="flex h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
    <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3">
      <Link to="/" onClick={onNavigate} className={cn('flex min-w-0 items-center gap-2.5 rounded-[6px]', collapsed && 'mx-auto', focusRing)} aria-label="Shekinah Galaxy Quest" title="Shekinah Galaxy Quest">
        <Sparkles className="h-9 w-9 shrink-0 text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.45)]" aria-hidden />
        {!collapsed && <span className="flex min-w-0 flex-col"><span className="truncate text-sm font-semibold leading-tight">Shekinah</span><span className="text-[11px] leading-tight opacity-80">Galaxy Quest</span></span>}
      </Link>
      {onClose && <button type="button" onClick={onClose} aria-label="Fechar menu" className={cn('rounded-[4px] p-1.5 opacity-80 hover:bg-sidebar-accent', focusRing)}><X className="h-4 w-4" /></button>}
    </div>
    <nav aria-label="Menu principal" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-3"><TooltipProvider delayDuration={150}><ul className="space-y-1">
      {APP_NAV.map(item => {
        const active = isActiveHref(pathname, item.href);
        const link = <Link to={item.href} onClick={onNavigate} aria-label={collapsed ? item.label : undefined} aria-current={active ? 'page' : undefined} className={cn('block rounded-[4px]', focusRing)}>
          <motion.div initial={{ opacity: 0, x: reduceMotion ? 0 : -8 }} animate={{ opacity: 1, x: 0 }} whileHover={reduceMotion ? undefined : { x: 4 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }} className={cn('relative flex w-full items-center gap-3 rounded-[4px] px-3 py-2 text-sm transition-colors', active ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground', collapsed && 'justify-center px-0 py-2.5')}>
            {active && <motion.span layoutId={reduceMotion ? undefined : 'sidebar-active-bar'} className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />}
            <item.icon className="h-5 w-5 shrink-0" aria-hidden />{!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
          </motion.div>
        </Link>;
        return <li key={item.href}>{collapsed ? <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{item.label}</TooltipContent></Tooltip> : link}</li>;
      })}
    </ul></TooltipProvider></nav>
    {collapsed ? <><div className="flex justify-center border-t border-sidebar-border p-2"><span className="text-[11px] leading-none opacity-70">v{version}</span></div><div className="flex shrink-0 justify-center border-t border-sidebar-border p-2"><Popover><PopoverTrigger asChild><button type="button" aria-label={name} title={name} className={cn('flex h-8 w-8 items-center justify-center rounded-full bg-primary/25 text-[11px] font-semibold text-sidebar-foreground ring-1 ring-primary/40 transition-colors hover:bg-primary/40', focusRing)}>{initials(name)}</button></PopoverTrigger><PopoverContent side="right" align="start" className="w-56 p-1"><p className="truncate px-2 py-1.5 text-sm font-semibold">{name}</p>{logoutButton}</PopoverContent></Popover></div></> : <div className="shrink-0 border-t border-sidebar-border p-2"><div className="flex items-center gap-2.5 px-2 py-1.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/25 text-[11px] font-semibold ring-1 ring-primary/40">{initials(name)}</span><span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-xs font-semibold">{name}</span><span className="text-[11px] opacity-70">v{version}</span></span></div>{logoutButton}</div>}
  </motion.aside>;
}
