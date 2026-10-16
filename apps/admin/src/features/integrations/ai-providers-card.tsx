import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { integrationPath, type IntegrationId } from '@shekinah/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TableAction } from '@/components/list/TableAction';
import { useIntegrations } from './hooks';
import { IntegrationError, IntegrationStatusDot } from './integration-feedback';
import { IntegrationTestDialog } from './integration-dialogs';

export function AiProvidersCard() {
  const query = useIntegrations();
  const providers = query.data?.filter(item => item.parent === 'ai') ?? [];
  const [testing, setTesting] = useState<IntegrationId | null>(null);
  return <Card>
    <CardHeader><CardTitle className="text-base">Provedores</CardTitle><CardDescription>Configure cada provedor na própria página.</CardDescription></CardHeader>
    <CardContent className="p-0">
      {query.isPending ? <div className="space-y-2 p-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
        : query.isError ? <IntegrationError retry={() => void query.refetch()} />
        : !providers.length ? <p className="p-4 text-sm text-muted-foreground">Nenhum provedor disponível.</p>
        : <motion.ul initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }} className="divide-y border-t">
          {providers.map(provider => <motion.li key={provider.id} variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.2 }} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
            <IntegrationStatusDot health={provider.health} />
            <Link to={integrationPath(provider.id)} className="group flex min-w-0 flex-1 items-center gap-3"><span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-medium">{provider.name}{!provider.configured && <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">Não configurado</Badge>}</span>
              <span className="block truncate text-xs text-muted-foreground" title={provider.description}>{provider.description}</span>
            </span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden /></Link>
            <TableAction type="test" onClick={() => setTesting(provider.id)} />
          </motion.li>)}
        </motion.ul>}
    </CardContent>
    {testing && <IntegrationTestDialog id={testing} onClose={() => setTesting(null)} />}
  </Card>;
}
