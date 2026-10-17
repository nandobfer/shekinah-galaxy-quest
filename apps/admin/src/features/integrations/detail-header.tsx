import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { integrationDefinition, integrationPath, type Integration } from '@shekinah/contracts';
import { Button } from '@/components/ui/button';
import { formatDate, IntegrationStatusDot } from './integration-feedback';
import { usePermissions } from '../users/hooks/usePermissions';

export function DetailHeader({ data }: { data: Integration }) {
  const def = integrationDefinition(data.id);
  const { can } = usePermissions();
  const back = def.parent && can(`integrations.${def.parent}.view`)
    ? { href: integrationPath(def.parent), label: `Voltar para ${integrationDefinition(def.parent).name}` }
    : { href: '/integracoes', label: 'Voltar para Integrações' };
  return <>
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
      <Button asChild variant="ghost" size="icon" className="mt-0.5" aria-label={back.label}><Link to={back.href}><ArrowLeft className="h-4 w-4" /></Link></Button>
      <div><h1 className="flex items-center gap-3 text-lg font-semibold md:text-2xl" aria-label={def.name}>{def.name}<IntegrationStatusDot health={data.health} /></h1>
        <p className="mt-1 text-sm text-muted-foreground">{def.description}</p>
        {data.updatedAt && <p className="mt-1 text-xs text-muted-foreground">Última alteração em {formatDate(data.updatedAt)}</p>}
      </div>
    </motion.div>
    <AnimatePresence>{!!def.secrets.length && !data.encryptionKeyConfigured && <motion.div role="alert"
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Chave de criptografia ausente no servidor (INTEGRATIONS_ENCRYPTION_KEY). Configure a chave no backend para definir ou substituir os campos privados.
    </motion.div>}</AnimatePresence>
  </>;
}
