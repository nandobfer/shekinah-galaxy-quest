import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { INTEGRATIONS, type IntegrationId } from '@shekinah/contracts';
import { IntegrationError } from './integration-feedback';
import { useIntegration } from './hooks';
import { IntegrationEditor } from './integration-editor';
import { RequireAccess } from '../users/components/RequireAccess';

export function IntegrationDetailPage() {
  const { integrationId, providerId } = useParams();
  const id = providerId ? `ai_${providerId}` : integrationId === 'ia' ? 'ai' : integrationId;
  if (!INTEGRATIONS.some(def => def.id === id)) return <div className="space-y-4"><h1 className="text-lg font-semibold">Integração não encontrada</h1><Link to="/integracoes" className="text-primary underline">Voltar às integrações</Link></div>;
  return <RequireAccess permission={`integrations.${id}.view`}><Detail key={id} id={id as IntegrationId} /></RequireAccess>;
}
function Detail({ id }: { id: IntegrationId }) {
  const query = useIntegration(id);
  if (query.isPending) return <div className="flex min-h-[50vh] items-center justify-center" role="status"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><span className="sr-only">Carregando integração...</span></div>;
  if (query.isError) return <IntegrationError retry={() => void query.refetch()} />;
  return <IntegrationEditor data={query.data} />;
}
