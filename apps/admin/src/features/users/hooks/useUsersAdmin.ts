import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type z } from 'zod';
import { type assignableRoleSchema, type userAccessUpdateSchema } from '@shekinah/contracts';
import { api } from '@/features/auth/session';

export type AssignableRole = z.infer<typeof assignableRoleSchema>;
export function useAdminUsers(enabled = true) { return useQuery({ queryKey: ['admin-users'], queryFn: ({ signal }) => api.permissions.users(signal), enabled }); }
export function useAssignableRoles(enabled = true) { return useQuery({ queryKey: ['assignable-roles'], queryFn: ({ signal }) => api.permissions.assignable(signal), enabled }); }
export function useSaveUser(id: string) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: (data: z.infer<typeof userAccessUpdateSchema>) => api.permissions.updateUser(id, data), onSuccess: async () => {
    toast.success('Usuário atualizado com sucesso');
    await Promise.all([['admin-users'], ['roles'], ['auth', 'session'], ['view-as']].map(queryKey => cache.invalidateQueries({ queryKey })));
  }, onError: error => toast.error(error.message) });
}
export function useDeleteUser() {
  const cache = useQueryClient();
  return useMutation({ mutationFn: ({ id, version }: { id: string; version: number }) => api.permissions.deleteUser(id, version), onSuccess: async () => {
    toast.success('Usuário excluído');
    await Promise.all([['admin-users'], ['roles'], ['view-as']].map(queryKey => cache.invalidateQueries({ queryKey })));
  }, onError: error => toast.error(error.message) });
}
