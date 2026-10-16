import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Integration, IntegrationId, IntegrationPatch } from '@shekinah/contracts';
import { api } from '../auth/session';

export const integrationsKey = ['integrations'] as const;
export function useIntegrations() {
  return useQuery({ queryKey: integrationsKey, queryFn: ({ signal }) => api.integrations.list(signal), refetchInterval: 15000 });
}
export function useIntegration(id: IntegrationId) {
  return useQuery({ queryKey: [...integrationsKey, id], queryFn: ({ signal }) => api.integrations.detail(id, signal), refetchInterval: 15000 });
}
export function useIntegrationLogs(id: IntegrationId, enabled: boolean) {
  return useQuery({ queryKey: [...integrationsKey, id, 'logs'], queryFn: ({ signal }) => api.integrations.logs(id, signal), enabled, refetchInterval: enabled ? 5000 : false });
}
export function useSaveIntegration(id: IntegrationId) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: IntegrationPatch) => api.integrations.save(id, input), onSuccess: data => {
    client.setQueryData<Integration>([...integrationsKey, id], previous => ({ ...data, ...(previous?.cronState ? { cronState: previous.cronState } : {}) }));
    void client.invalidateQueries({ queryKey: integrationsKey }); toast.success('Configuração salva.');
  }, onError: (error: Error) => toast.error(error.message) });
}
export function useTestIntegration(id: IntegrationId) {
  const client = useQueryClient();
  return useMutation({ mutationFn: () => api.integrations.test(id), onSuccess: () => { void client.invalidateQueries({ queryKey: integrationsKey }); }, onError: (error: Error) => toast.error(error.message) });
}
export function useRunHealthCheck() {
  const client = useQueryClient();
  return useMutation({ mutationFn: () => api.integrations.runHealthCheck(), onSuccess: data => {
    void client.invalidateQueries({ queryKey: integrationsKey });
    if (data.lastStatus === 'error') toast.error(data.message); else toast.success(data.message);
  }, onError: (error: Error) => toast.error(error.message) });
}
