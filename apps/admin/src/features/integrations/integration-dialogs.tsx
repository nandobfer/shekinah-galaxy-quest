import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, RotateCcw, X, XCircle } from 'lucide-react';
import { integrationDefinition, type IntegrationId } from '@shekinah/contracts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTestIntegration } from './hooks';
import { formatDate } from './integration-feedback';
import { IntegrationConsole, IntegrationDebugConsole } from './integration-logs-panel';
import { IconAction } from './icon-action';

export function IntegrationTestDialog({ id, onClose }: { id: IntegrationId; onClose: () => void }) {
  const { mutate, ...test } = useTestIntegration(id);
  // Opening the dialog is the explicit test action, as in Opex. Never run from page mount.
  useEffect(() => { const timer = setTimeout(() => mutate(), 0); return () => clearTimeout(timer); }, [mutate]);
  const success = test.data?.state === 'ok';
  return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="max-w-3xl overflow-hidden p-0">
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 p-6">
      <DialogHeader><DialogTitle>Testar conexão — {integrationDefinition(id).name}</DialogTitle><DialogDescription>Verificação da configuração salva. O diagnóstico aparece abaixo ao concluir.</DialogDescription></DialogHeader>
      <IntegrationConsole className="h-[360px]">
        {test.data ? <p className={success ? 'text-[#4ade80]' : 'text-[#ff6b6b]'}>{formatDate(test.data.checkedAt)} [{integrationDefinition(id).name.toUpperCase()}] {test.data.message}</p>
          : test.isError ? <p role="alert" className="text-[#ff6b6b]">{test.error.message}</p> : <p className="text-slate-500">Iniciando teste...</p>}
      </IntegrationConsole>
      <div className="flex min-h-10 items-center justify-between gap-4">
        {test.isPending ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Testando conexão...</p>
          : test.data ? <p role="status" className={`flex items-center gap-2 text-sm font-medium ${success ? 'text-emerald-600' : 'text-destructive'}`}>{success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{success ? 'Conexão OK' : 'Falha na conexão'}{!!test.data.latencyMs && <span className="font-normal text-muted-foreground">· {test.data.latencyMs} ms</span>}</p> : <span />}
        <Button type="button" variant="outline" onClick={() => mutate()} disabled={test.isPending}><RotateCcw className="mr-2 h-4 w-4" />Testar novamente</Button>
      </div>
    </motion.div>
  </DialogContent></Dialog>;
}
export function IntegrationDebugDialog({ id, onClose }: { id: IntegrationId; onClose: () => void }) {
  return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="max-w-5xl overflow-hidden p-0 [&>button:last-child]:hidden">
    <div className="flex h-[75dvh] flex-col p-6"><DialogDescription className="sr-only">Diagnósticos sanitizados da integração, retidos por 48 horas.</DialogDescription>
      <IntegrationDebugConsole id={id} title={<DialogTitle>Logs — {integrationDefinition(id).name}</DialogTitle>}
        actions={<IconAction label="Fechar" icon={<X className="h-4 w-4" />} onClick={onClose} />} />
    </div>
  </DialogContent></Dialog>;
}
