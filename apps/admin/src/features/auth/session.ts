import { QueryClient, useQuery } from '@tanstack/react-query';
import { createApiClient } from '@shekinah/api-client';

export const sessionKey = ['auth', 'session'] as const;
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 }, mutations: { retry: false } } });
export const api = createApiClient({ onUnauthorized: () => {
  // Remove all protected data, not just the identity record.
  queryClient.removeQueries({ predicate: query => query.queryKey[0] !== 'auth' });
  queryClient.setQueryData(sessionKey, null);
} });
export function useSession() {
  return useQuery({ queryKey: sessionKey, queryFn: ({ signal }) => api.session(signal), staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 60000 });
}
