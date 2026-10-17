import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { type AdminUserDto } from '@shekinah/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useDialogPresence } from '@/hooks/useDialogPresence';
import { tabMotionProps } from '@/lib/tab-motion';
import { userInputSchema, type UserInput } from '../schemas';
import { useAssignableRoles, useSaveUser } from '../hooks/useUsersAdmin';
import { UserGeneralTab } from './UserGeneralTab';
import { UserRoleSelect } from './UserRoleSelect';

interface Props { open: boolean; user: AdminUserDto | null; isSelf: boolean; onOpenChange: (open: boolean) => void; }
export function UserFormDialog(props: Props) {
  return props.user ? <UserEditor key={props.user.id} {...props} user={props.user} /> : null;
}
function UserEditor({ open, user, isSelf, onOpenChange }: Omit<Props, 'user'> & { user: AdminUserDto }) {
  const { isVisible, panelProps } = useDialogPresence(open);
  const [tab, setTab] = useState('geral');
  const form = useForm<UserInput>({ resolver: zodResolver(userInputSchema), defaultValues: { nome: user.nome, email: user.email, ativo: user.ativo, cargos: [...user.roleIds], version: user.version }, mode: 'onChange' });
  const roles = useAssignableRoles(open);
  const save = useSaveUser(user.id);
  const cargos = form.watch('cargos');
  const { errors, submitCount } = form.formState;
  useEffect(() => {
    if (!submitCount) return;
    const target = errors.nome || errors.email ? 'geral' : errors.cargos ? 'perfis' : null;
    if (target) queueMicrotask(() => setTab(target));
  }, [submitCount, errors]);
  const selected = useMemo(() => {
    const byId = new Map([...user.cargos, ...(roles.data ?? [])].map(role => [role.id, role]));
    return cargos.map(id => byId.get(id)).filter((role): role is NonNullable<typeof role> => !!role);
  }, [cargos, user.cargos, roles.data]);
  const submit = form.handleSubmit(async data => {
    try { await save.mutateAsync({ nome: data.nome, ativo: data.ativo, cargos: data.cargos, version: data.version }); onOpenChange(false); } catch { /* The mutation displays the recoverable error and preserves the draft. */ }
  });
  const close = (next: boolean) => {
    if (save.isPending) return;
    if (!next && form.formState.isDirty && !window.confirm('Descartar as alterações não salvas?')) return;
    onOpenChange(next);
  };
  useEffect(() => {
    if (open) { form.reset({ nome: user.nome, email: user.email, ativo: user.ativo, cargos: [...user.roleIds], version: user.version }); queueMicrotask(() => setTab('geral')); }
  }, [open, user, form]);
  if (!isVisible) return null;
  return <Dialog open={isVisible} onOpenChange={close}>
    <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-2xl">
      <motion.div {...panelProps} className="flex h-full min-h-0 flex-col">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4"><DialogTitle className="text-lg font-semibold">Editar Usuário</DialogTitle><DialogDescription className="sr-only">Dados e perfis do usuário</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-6 pt-4"><TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted p-1 text-muted-foreground"><TabsTrigger value="geral">Geral</TabsTrigger><TabsTrigger value="perfis">Perfis</TabsTrigger></TabsList></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4"><AnimatePresence mode="wait">
              <TabsContent value="geral" key="geral"><motion.div {...tabMotionProps}><UserGeneralTab form={form} isSelf={isSelf} selectedRoles={selected} onGoToRoles={() => setTab('perfis')} /></motion.div></TabsContent>
              <TabsContent value="perfis" key="perfis"><motion.div {...tabMotionProps} className="space-y-2">
                {roles.isError ? <ErrorState onRetry={() => void roles.refetch()} /> : <UserRoleSelect value={cargos} onChange={next => form.setValue('cargos', next, { shouldDirty: true, shouldValidate: true })} roles={roles.data} isLoading={roles.isPending} readOnly={isSelf || save.isPending} readOnlyReason="Você não pode alterar os próprios perfis." />}
                {errors.cargos && <p className="text-sm text-destructive">{errors.cargos.message}</p>}
              </motion.div></TabsContent>
            </AnimatePresence></div>
          </Tabs>
          <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={save.isPending}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Alterações</Button>
          </DialogFooter>
        </form>
      </motion.div>
    </DialogContent>
  </Dialog>;
}
