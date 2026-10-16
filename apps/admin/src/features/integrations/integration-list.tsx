import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { integrationPath, type IntegrationId } from '@shekinah/contracts';
import { CadastroHeader } from '@/components/list/CadastroHeader';
import { CadastroTableCard } from '@/components/list/CadastroTableCard';
import { CadastroTableSkeleton } from '@/components/list/CadastroTableSkeleton';
import { TableAction } from '@/components/list/TableAction';
import { Badge } from '@/components/ui/badge';
import { useIntegrations } from './hooks';
import { EnvironmentBadge, IntegrationError, IntegrationStatusDot } from './integration-feedback';
import { IntegrationDebugDialog, IntegrationTestDialog } from './integration-dialogs';

/** Opex IntegrationList port: linked rows, external actions, badges and staggered entrance. */
export function IntegrationList() {
  const query = useIntegrations();
  const [testing, setTesting] = useState<IntegrationId | null>(null);
  const [debugging, setDebugging] = useState<IntegrationId | null>(null);
  const integrations = query.data?.filter(item => !item.parent) ?? [];
  return <div className="flex flex-col gap-6">
    <CadastroHeader title="Integrações" description="Serviços usados pelo app: status da conexão, configuração e logs de debug" />
    <CadastroTableCard>{query.isPending ? <CadastroTableSkeleton columns={4} rows={6} /> : query.isError ? <IntegrationError retry={() => void query.refetch()} /> : !integrations.length ? <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma integração disponível.</p> : <motion.ul initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }} className="divide-y">
      {integrations.map(integration => <motion.li key={integration.id} variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.25, ease: 'easeOut' }} className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/50">
        <IntegrationStatusDot health={integration.health} />
        <Link to={integrationPath(integration.id)} className="group flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-medium">{integration.name}<EnvironmentBadge environment={integration.environment} />{!integration.configured && <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">Não configurado</Badge>}</span><span className="block truncate text-xs text-muted-foreground" title={integration.description}>{integration.description}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden /></Link>
        <div className="flex shrink-0 items-center gap-1"><TableAction type="test" onClick={() => setTesting(integration.id)} /><TableAction type="debug" onClick={() => setDebugging(integration.id)} disabled={!integration.debugMode} disabledReason="Ative o modo debug na integração para acompanhar os logs" /></div>
      </motion.li>)}
    </motion.ul>}</CadastroTableCard>
    {testing && <IntegrationTestDialog key={testing} id={testing} onClose={() => setTesting(null)} />}
    {debugging && <IntegrationDebugDialog key={debugging} id={debugging} onClose={() => setDebugging(null)} />}
  </div>;
}
