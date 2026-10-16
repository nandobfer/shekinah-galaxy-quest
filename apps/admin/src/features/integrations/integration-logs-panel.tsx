import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Bug, Maximize2, Minimize2, PlugZap, RefreshCw } from 'lucide-react';
import type { IntegrationId } from '@shekinah/contracts';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { IconAction } from './icon-action';
import { useIntegrationLogs, useTestIntegration } from './hooks';
import { IntegrationError, formatDate } from './integration-feedback';

/** Read-only console with the same palette as the Opex terminal; renders only sanitized DTOs. */
export function IntegrationConsole({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div role="log" aria-live="polite" className={`overflow-auto rounded-md bg-[#0b1020] p-3 font-mono text-xs leading-5 text-[#d6deeb] ${className}`}>{children}</div>;
}

export function IntegrationDebugConsole({ id, title, onMaximize, maximized, actions }: {
  id: IntegrationId; title: ReactNode; onMaximize?: () => void; maximized?: boolean; actions?: ReactNode;
}) {
  const logs = useIntegrationLogs(id, true);
  const test = useTestIntegration(id);
  const [term, setTerm] = useState('');
  const records = logs.data?.filter(log => !term || `${log.message} ${log.source}`.toLocaleLowerCase().includes(term.toLocaleLowerCase())) ?? [];
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 truncate">{title}</div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground" title="Atualização automática a cada 5 segundos"><span className="h-2 w-2 rounded-full bg-slate-400" />Sem tempo real</span>
        <IconAction label="Testar conexão" icon={<PlugZap className={`h-4 w-4 ${test.isPending ? 'animate-spin' : ''}`} />} disabled={test.isPending} onClick={() => test.mutate()} />
        <IconAction label="Atualizar" icon={<RefreshCw className={`h-4 w-4 ${logs.isFetching ? 'animate-spin' : ''}`} />} disabled={logs.isFetching} onClick={() => void logs.refetch()} />
        {onMaximize && <IconAction label={maximized ? 'Restaurar' : 'Maximizar'} icon={maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />} onClick={onMaximize} />}
        {actions}
      </div>
    </div>
    <Input placeholder="Buscar nos logs" aria-label="Buscar nos logs" value={term} onChange={event => setTerm(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' && term) { event.preventDefault(); event.stopPropagation(); setTerm(''); } }} className="h-8" />
    {logs.isError ? <IntegrationError retry={() => void logs.refetch()} /> : <IntegrationConsole className="min-h-0 flex-1">
      {logs.isPending ? <p role="status">Carregando logs...</p> : !records.length ? <p className="text-slate-500">{term ? 'Nenhum log encontrado.' : 'Aguardando eventos...'}</p>
        : records.map((log, index) => <p key={`${log.at}-${index}`} className={`whitespace-pre-wrap break-words ${log.level === 'error' ? 'text-[#ff6b6b]' : ''}`}>{formatDate(log.at)} [{log.source}] {log.message}</p>)}
    </IntegrationConsole>}
    {test.isError && <p role="alert" className="text-sm text-destructive">{test.error.message}</p>}
    {test.data && <p role="status" className={`text-xs ${test.data.state === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{test.data.message}</p>}
  </div>;
}

export function IntegrationLogsPanel({ id }: { id: IntegrationId }) {
  const ref = useRef<HTMLElement>(null);
  const [height, setHeight] = useState<number>();
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const main = ref.current?.closest('main');
    if (!main || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(main);
      setHeight(Math.max(360, main.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)));
    });
    observer.observe(main);
    return () => observer.disconnect();
  }, []);
  return <motion.aside ref={ref} initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
    className="sticky top-0 min-w-0" style={{ height: height ?? 500 }} data-testid="integration-debug-panel">
    <Card className="flex h-full min-h-[360px] flex-col"><CardContent className="flex min-h-0 flex-1 flex-col pt-6">
      {!maximized && <IntegrationDebugConsole id={id} title={<h2 className="flex items-center gap-2 text-base font-semibold"><Bug className="h-4 w-4 text-amber-600" />Logs</h2>} onMaximize={() => setMaximized(true)} />}
    </CardContent></Card>
    <Dialog open={maximized} onOpenChange={setMaximized}><DialogContent className="flex h-[90dvh] max-w-[calc(100vw-3rem)] flex-col">
      <IntegrationDebugConsole id={id} title={<DialogTitle>Logs</DialogTitle>} maximized onMaximize={() => setMaximized(false)} />
    </DialogContent></Dialog>
  </motion.aside>;
}
