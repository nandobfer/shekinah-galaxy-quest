"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { AnimatePresence, motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { canManageRole, toRoleLike } from "@nandobfer/perfix"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { tabMotionProps } from "@/lib/tab-motion"
import { usePermissions } from "@/features/users/hooks/usePermissions"
import { apiErrorMessage } from "@/lib/api"
import { catalog } from "@/lib/permissions/catalog"
import { ADMIN_ROLE_SLUG } from "@/lib/permissions/bootstrap-roles"
import type { IRole } from "../types"
import { useRoleForm } from "../hooks/useRoleForm"
import { useRoleMembersEditor } from "../hooks/useRoleMembersEditor"
import { RoleMembersPanel } from "./RoleMembersPanel"
import { RoleAuditTab } from "./role-form/RoleAuditTab"
import { RoleFormHeader } from "./role-form/RoleFormHeader"
import { RoleGeneralTab } from "./role-form/RoleGeneralTab"
import { RolePermissionsTab } from "./role-form/RolePermissionsTab"

interface RoleFormProps {
    role?: IRole // presente = modo edição
    onCancel: () => void
}

const GERAL_FIELDS = ["nome", "descricao", "cor", "ativo", "escopos"]

/**
 * Criação, edição e visualização de perfil (copiado do Smart Desk, decomposto em abas).
 *
 * O RODAPÉ É ÚNICO E FICA FORA DA ÁREA QUE ROLA: só o corpo rola; header, abas e rodapé ficam
 * fixos. Dois níveis de bloqueio, porque são capacidades diferentes: `camposBloqueados`
 * (Geral e Permissões — `roles.edit` + hierarquia) e `membrosBloqueados` (aba Membros — também
 * `users.edit`). Sem espelhar isso aqui, a tela ofereceria uma edição que volta 403.
 */
export function RoleForm({ role, onCancel }: RoleFormProps) {
    const [activeTab, setActiveTab] = useState<string>("geral")
    const { cargos, userId, can, canAll, isAdministrator } = usePermissions()
    const members = useRoleMembersEditor(role)
    const saved = useRef(false)

    const isAdminRole = role?.slug === ADMIN_ROLE_SLUG
    const cargoForaDoAlcance = useMemo(() => {
        if (!role) return false
        return isAdminRole ? !isAdministrator : !canManageRole(cargos, toRoleLike(role))
    }, [cargos, isAdminRole, isAdministrator, role])
    const camposBloqueados = !can("roles.edit") || cargoForaDoAlcance
    const membrosBloqueados = !canAll(["roles.edit", "users.edit"]) || cargoForaDoAlcance

    const { register, setValue, watch, onSubmit, isSubmitting, formState } = useRoleForm({
        role,
        getMembers: () => !membrosBloqueados && members.membrosMudaram ? members.membros : undefined,
        onSuccess: async () => {
            saved.current = true
            toast.success(`Perfil ${role ? "atualizado" : "criado"} com sucesso`)
            onCancel()
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, "Erro ao salvar perfil")),
    })
    const { errors, submitCount } = formState
    const dirty = formState.isDirty || members.membrosMudaram
    const blocker = useBlocker(() => dirty && !saved.current)
    useBeforeUnload(useCallback((event: BeforeUnloadEvent) => { if (dirty && !saved.current) { event.preventDefault(); event.returnValue = '' } }, [dirty]))

    // Perfil totalmente bloqueado salva só membros, quando essa segunda capacidade existe.
    const handleSubmit = camposBloqueados
        ? async (event: FormEvent) => {
              event.preventDefault()
               if (!(await members.salvarMembros())) return
               saved.current = true
              toast.success("Membros atualizados com sucesso")
              onCancel()
          }
        : onSubmit

    const nome = watch("nome")
    const cor = watch("cor")
    const ativo = watch("ativo")
    const permissoes = watch("permissoes")
    const selecionadas = useMemo(() => new Set(permissoes ?? []), [permissoes])


    /** Quantas permissões os membros PERDEM ao salvar (só chaves que ainda existem no catálogo). */
    const removidas = useMemo(() => {
        if (!role) return 0
        const conhecidas = (role.permissoes ?? []).filter((key) => catalog.isKnownKey(key))
        if (role.ativo && !ativo) return conhecidas.length
        return conhecidas.filter((key) => !selecionadas.has(key)).length
    }, [role, selecionadas, ativo])

    /**
     * Leva o usuário à aba que tem erro — UMA VEZ POR SUBMIT. `activeTab` não pode ser o gatilho:
     * reagir à troca de aba prenderia o usuário na aba com erro.
     */
    const submitRoteado = useRef(0)
    useEffect(() => {
        if (submitCount === 0 || submitRoteado.current === submitCount) return
        submitRoteado.current = submitCount

        const hasGeralErrors = Object.keys(errors).some((key) => GERAL_FIELDS.includes(key))
        const nextTab = hasGeralErrors ? "geral" : errors.permissoes ? "permissoes" : null
        if (nextTab) queueMicrotask(() => setActiveTab(nextTab))
    }, [submitCount, errors])

    const salvando = isSubmitting || members.isSaving
    // Sem nada editável o rodapé vira só "Fechar" — um Salvar inerte é pior que nenhum.
    const podeSalvar = !camposBloqueados || (!membrosBloqueados && !!role)

    return (
        <><div className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <RoleFormHeader nome={nome} cor={cor} onBack={onCancel} />

            <form onSubmit={handleSubmit} id="role-form" className="flex min-h-0 flex-1 flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
                    {/* Classes literais: o JIT do Tailwind não gera classe montada em runtime. */}
                    <div className="shrink-0 overflow-x-auto px-6 pt-4">
                        <TabsList
                            aria-label="Abas do perfil"
                            className={`flex w-max min-w-full sm:grid sm:w-full ${role ? can('users.view') ? "sm:grid-cols-4" : "sm:grid-cols-3" : "sm:grid-cols-2"} rounded-xl bg-gray-100 p-1 text-gray-600 dark:bg-gray-700/60 dark:text-gray-200`}
                        >
                            <TabsTrigger value="geral" className="flex-1 sm:flex-none">Geral</TabsTrigger>
                            <TabsTrigger value="permissoes" className="flex-1 sm:flex-none">Permissões</TabsTrigger>
                            {role && can('users.view') && <TabsTrigger value="membros" className="flex-1 sm:flex-none">Membros</TabsTrigger>}
                            {role && <TabsTrigger value="log" className="flex-1 sm:flex-none">Log de Auditoria</TabsTrigger>}
                        </TabsList>
                    </div>

                    {/* ÚNICA área que rola, e é um bloco comum — numa coluna flex os cartões encolheriam. */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                        <AnimatePresence mode="wait">
                            <TabsContent value="geral" key="geral">
                                <motion.div {...tabMotionProps} className="space-y-4">
                                    <RoleGeneralTab
                                        register={register}
                                        errors={errors}
                                        cor={cor}
                                        ativo={ativo}
                                        onCorChange={(token) => setValue("cor", token, { shouldDirty: true })}
                                        onAtivoChange={(checked) => {
                                            setValue("ativo", checked, { shouldDirty: true })
                                            if (!checked) members.descartarInclusoes()
                                        }}
                                        camposBloqueados={camposBloqueados}
                                        salvando={salvando}
                                        isAdminRole={isAdminRole}
                                    />
                                </motion.div>
                            </TabsContent>

                            <TabsContent value="permissoes" key="permissoes">
                                <motion.div {...tabMotionProps} className="space-y-3">
                                    <RolePermissionsTab
                                        selecionadas={selecionadas}
                                        onChange={(next) => setValue("permissoes", [...next], { shouldDirty: true })}
                                        readOnly={camposBloqueados || isAdminRole || salvando}
                                        errors={errors}
                                        usuariosCount={role?.usuariosCount ?? 0}
                                        removidas={removidas}
                                    />
                                </motion.div>
                            </TabsContent>

                            {role && can('users.view') && (
                                <TabsContent value="membros" key="membros">
                                    <motion.div {...tabMotionProps}>
                                        <RoleMembersPanel
                                            value={members.membros}
                                            onChange={members.setMembros}
                                            immutableUserIds={members.usuarios.filter(user => !user.gerenciavel || user._id === userId).map(user => user._id)}
                                            disabled={salvando || membrosBloqueados}
                                            additionsDisabled={!ativo}
                                            additionsDisabledReason="Perfis inativos não podem receber novos membros."
                                            disabledReason={
                                                cargoForaDoAlcance
                                                    ? "Este perfil está acima do seu alcance hierárquico. A lista está em modo de leitura."
                                                    : membrosBloqueados
                                                      ? "Você não tem permissão para conceder perfis, então esta lista está em modo de leitura."
                                                      : undefined
                                            }
                                        />
                                    </motion.div>
                                </TabsContent>
                            )}

                            {role && (
                                <TabsContent value="log" key="log">
                                    <RoleAuditTab role={role} />
                                </TabsContent>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={salvando}>
                            {podeSalvar ? "Cancelar" : "Fechar"}
                        </Button>
                        {podeSalvar && (
                            <Button type="submit" disabled={salvando || (camposBloqueados && !members.membrosMudaram)}>
                                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        )}
                    </div>
                </Tabs>
            </form>
        </div><AlertDialog open={blocker.state === 'blocked'}><AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Descartar alterações?</AlertDialogTitle><AlertDialogDescription>Existem alterações não salvas neste perfil.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => { if (blocker.state === 'blocked') blocker.reset() }}>Continuar editando</AlertDialogCancel><AlertDialogAction disabled={salvando} onClick={() => { if (blocker.state === 'blocked') blocker.proceed() }}>Descartar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent></AlertDialog></>
    )
}
