import type { IntegrationHealth } from '@shekinah/contracts';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';

export function IntegrationStatusDot({ health }: { health: IntegrationHealth }) {
  const reduce = useReducedMotion();
  const color = health.state === 'ok' ? 'emerald' : health.state === 'error' ? 'red' : health.state === 'disabled' ? 'amber' : 'slate';
  const label = health.state === 'ok' ? 'Conectado' : health.state === 'error' ? 'Falha na conexão' : health.state === 'disabled' ? 'Desativado' : health.state === 'not_configured' ? 'Não configurado' : 'Ainda não verificado';
  const styles = { emerald: ['bg-emerald-500', 'bg-emerald-500/40'], red: ['bg-red-500', 'bg-red-500/40'], amber: ['bg-amber-500', 'bg-amber-500/40'], slate: ['bg-slate-400', 'bg-slate-400/30'] };
  return <TooltipProvider><Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-label={label} data-status={health.state} className="relative inline-flex h-3 w-3 shrink-0">
    {!reduce && color !== 'slate' && <motion.span className={cn('absolute inline-flex h-full w-full rounded-full', styles[color][1])} initial={{ scale: 1, opacity: 0.7 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />}
    <motion.span key={`${health.state}:${health.checkedAt ?? ''}`} className={cn('relative inline-flex h-3 w-3 rounded-full', styles[color][0])} initial={reduce ? false : { scale: 0.4 }} animate={{ scale: 1 }} transition={{ duration: 0.45, ease: 'easeOut' }} />
  </span></TooltipTrigger><TooltipContent className="max-w-xs"><p className="font-medium">{label}</p>{health.message && <p className="text-xs opacity-80">{health.message}</p>}{health.checkedAt && <p className="mt-1 text-xs opacity-70">{formatDate(health.checkedAt)} · {health.latencyMs} ms</p>}</TooltipContent></Tooltip></TooltipProvider>;
}
export function EnvironmentBadge({ environment }: { environment: 'interno' | 'externo' }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', environment === 'interno' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300')}>{environment === 'interno' ? 'Interno' : 'Externo'}</span>;
}
export function IntegrationError({ retry }: { retry: () => void }) {
  return <div className="space-y-3 p-6 text-center"><p role="alert" className="text-sm text-destructive">Não foi possível carregar as integrações. Verifique sua conexão.</p><Button variant="outline" onClick={retry}>Tentar novamente</Button></div>;
}
export const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : '—';
