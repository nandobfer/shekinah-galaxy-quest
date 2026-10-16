import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronDown, Clock, Cog, Loader2, Play, Search } from 'lucide-react';
import { HEALTH_CHECK_JOB_LABEL, type CronState, type PublicValue } from '@shekinah/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useRunHealthCheck } from './hooks';
import { formatDate } from './integration-feedback';
import { cardMotion } from './public-fields-card';

export function CronJobsCard({ state, dirty, values, setValue, disabled }: {
  state?: CronState; dirty: boolean; values: Record<string, PublicValue>;
  setValue: (key: string, value: PublicValue) => void; disabled: boolean;
}) {
  const run = useRunHealthCheck();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [term, setTerm] = useState('');
  const enabled = Boolean(values.jobEnabled);
  const minutes = Number(values.intervalMinutes ?? 5);
  const unit = minutes % 60 === 0 ? 'hours' : 'minutes';
  return <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.15 }}><Card>
    <CardHeader><CardTitle className="text-base">Rotinas</CardTitle><CardDescription>Executadas por uma única instância do servidor por vez. Horários de Brasília.</CardDescription></CardHeader>
    <CardContent><div className="space-y-3">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={term} onChange={event => setTerm(event.target.value)} placeholder="Buscar rotina" aria-label="Buscar rotina" className="pl-9" /></div>
      {!HEALTH_CHECK_JOB_LABEL.toLocaleLowerCase().includes(term.toLocaleLowerCase()) ? <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhuma rotina encontrada</p>
        : <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.22 }} className={cn('rounded-lg border p-4 transition-opacity', !enabled && 'opacity-70')}>
          <div className="flex items-center gap-2"><Cog className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
              <span className="truncate font-medium">{HEALTH_CHECK_JOB_LABEL}</span><ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
            </button>
            <Button type="button" variant="outline" size="sm" className="h-8" aria-label={`Executar agora: ${HEALTH_CHECK_JOB_LABEL}`} disabled={disabled || dirty || run.isPending || state?.running} title={dirty ? 'Salve as alterações antes de executar' : state?.running ? 'A rotina já está em execução' : undefined} onClick={() => setConfirm(true)}>
              {run.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}Executar agora
            </Button>
            <Switch checked={enabled} onCheckedChange={value => setValue('jobEnabled', value)} disabled={disabled} aria-label={`Ativar ${HEALTH_CHECK_JOB_LABEL}`} />
          </div>
          <div className="mt-2 pl-6"><span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {state?.running || run.isPending ? <span className="flex items-center gap-1 text-sky-600"><Loader2 className="h-3.5 w-3.5 animate-spin" />Executando</span>
              : !enabled ? 'Desativada' : <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Próxima: {formatDate(state?.nextRunAt ?? null)}</span>}
            {state?.lastRunAt && <span className={cn('flex items-center gap-1', state.lastStatus === 'error' ? 'text-destructive' : 'text-emerald-600')} title={state.message ?? undefined}>
              {state.lastStatus === 'error' ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Última: {formatDate(state.lastRunAt)}
            </span>}
          </span></div>
          <AnimatePresence initial={false}>{open && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="overflow-hidden">
            <div className="space-y-4 pt-4"><div className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center" data-testid="schedule-row">
              <Select value="interval" disabled><SelectTrigger className="w-full min-w-0 sm:flex-1" aria-label="Frequência"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="interval">A cada intervalo</SelectItem></SelectContent></Select>
              <Input type="number" min={1} max={unit === 'hours' ? 24 : 1440} className="w-full min-w-0 sm:flex-1" aria-label="Intervalo" value={unit === 'hours' ? minutes / 60 : minutes} disabled={disabled}
                onChange={event => setValue('intervalMinutes', Number(event.target.value) * (unit === 'hours' ? 60 : 1))} />
              <Select value={unit} onValueChange={next => setValue('intervalMinutes', next === 'hours' ? Math.min(1440, (unit === 'hours' ? minutes / 60 : minutes) * 60) : unit === 'hours' ? minutes / 60 : minutes)} disabled={disabled}>
                <SelectTrigger className="w-full min-w-0 sm:flex-1" aria-label="Unidade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">minutos</SelectItem><SelectItem value="hours">horas</SelectItem></SelectContent>
              </Select>
            </div><p className="text-xs text-muted-foreground">A cada {minutes} minutos</p></div></div>
          </motion.div>}</AnimatePresence>
        </motion.div>}
      {run.isError && <p role="alert" className="text-sm text-destructive">{run.error.message}</p>}
    </div></CardContent>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Executar “{HEALTH_CHECK_JOB_LABEL}” agora?</AlertDialogTitle><AlertDialogDescription>A rotina salva será executada imediatamente, com os mesmos efeitos da execução agendada.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { setConfirm(false); run.mutate(); }}>Executar agora</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </Card></motion.div>;
}
