import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/features/auth/session';
export function useViewAsRoles(enabled: boolean) {
  return useQuery({ queryKey: ['view-as', 'roles'], queryFn: async ({ signal }) => (await api.permissions.viewRoles(signal)).map(role => ({ ...role, coringa: role.permissoes.includes('*') })), enabled });
}
export function useViewAsUsers(search: string, enabled: boolean) {
  const [term, setTerm] = useState(search.trim());
  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const query = useQuery({ queryKey: ['view-as', 'users', term], queryFn: async ({ signal }) => ({ items: await api.permissions.viewUsers(term, signal) }), enabled });
  return { ...query, term };
}
