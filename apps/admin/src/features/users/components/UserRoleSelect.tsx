"use client"

import { useMemo } from "react"
import { ShieldOff } from "lucide-react"
import { expandPermissions, toRoleLike, type UnassignableReason } from "@nandobfer/perfix"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { PermissionCheckbox } from "@/features/roles/components/permissions/PermissionCheckbox"
import { PermissionSummary } from "@/features/roles/components/permissions/PermissionSummary"
import { RoleChip } from "@/features/roles/components/permissions/RoleChip"
import { usePermissions } from "../hooks/usePermissions"
import type { AssignableRole } from "../hooks/useUsersAdmin"
import { UNASSIGNABLE_PROFILE_LABELS } from "../utils/profile-labels"

interface UserRoleSelectProps {
    /** Ids dos perfis. É a lista COMPLETA, não um delta. */
    value: string[]
    onChange: (roleIds: string[]) => void
    roles: AssignableRole[] | undefined
    isLoading?: boolean
    readOnly?: boolean
    /** Explica por que a edição está bloqueada, quando está. */
    readOnlyReason?: string
}

/**
 * Escolha dos perfis de um usuário — SELETOR, não editor (copiado do Smart Desk).
 *
 * As permissões pertencem ao perfil; abaixo da lista aparece o RESULTADO de empilhar os perfis
 * marcados, em modo leitura. Perfis fora do alcance de quem edita aparecem esmaecidos, com o
 * motivo no tooltip — a mesma regra que o servidor aplica (hierarquia/chave sensível).
 */
export function UserRoleSelect({ value, onChange, roles, isLoading, readOnly, readOnlyReason }: UserRoleSelectProps) {
    const { isAdministrator } = usePermissions()
    const selecionados = useMemo(() => new Set(value), [value])

    /** Conjunto efetivo do usuário SENDO EDITADO — a soma dos perfis marcados. */
    const efetivas = useMemo(() => {
        const marcados = (roles ?? []).filter((role) => selecionados.has(role.id))
        return expandPermissions(marcados.map((role) => toRoleLike({ id: role.id, nome: role.nome, permissoes: role.permissoes })))
    }, [roles, selecionados])

    const alternar = (role: AssignableRole, marcar: boolean) => {
        if (readOnly || role.bloqueado) return
        onChange(marcar ? [...value, role.id] : value.filter((id) => id !== role.id))
    }

    if (isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 rounded-lg" />
                ))}
            </div>
        )
    }

    if ((roles ?? []).length === 0) {
        return (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <ShieldOff className="mx-auto mb-2 h-7 w-7 opacity-20" />
                <p className="text-sm">Nenhum perfil disponível.</p>
            </div>
        )
    }

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-3">
                {readOnly && readOnlyReason && (
                    <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{readOnlyReason}</p>
                )}

                {/* `space-y-2` num bloco comum (não `flex flex-col` com teto): os filhos transbordam em vez de encolher. */}
                <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
                    {(roles ?? []).map((role) => (
                        <RoleRow
                            key={role.id}
                            role={role}
                            marcado={selecionados.has(role.id)}
                            readOnly={readOnly}
                            onToggle={(marcar) => alternar(role, marcar)}
                        />
                    ))}
                </div>

                <div className="space-y-2 border-t border-border pt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permissões resultantes</h3>
                    <PermissionSummary selected={efetivas} variant="full" />
                    {!isAdministrator && (
                        <p className="text-[11px] text-muted-foreground">As permissões pertencem ao perfil e são definidas por um administrador.</p>
                    )}
                </div>
            </div>
        </TooltipProvider>
    )
}

interface RoleRowProps {
    role: AssignableRole
    marcado: boolean
    readOnly?: boolean
    onToggle: (marcar: boolean) => void
}

function RoleRow({ role, marcado, readOnly, onToggle }: RoleRowProps) {
    const bloqueado = readOnly || role.bloqueado
    const mensagemBloqueio = !role.bloqueado
        ? undefined
        : marcado
          ? "Este perfil já estava atribuído e será preservado — você não pode alterá-lo"
          : role.motivo
            ? UNASSIGNABLE_PROFILE_LABELS[role.motivo as UnassignableReason]
            : "Você não pode conceder este perfil"

    const linha = (
        <div
            className={cn(
                "flex items-center gap-3 rounded-lg border p-2.5 transition-colors",
                marcado ? "border-primary bg-primary/5" : "border-border",
                bloqueado ? "opacity-50" : "cursor-pointer hover:border-primary/60",
            )}
            onClick={() => !bloqueado && onToggle(!marcado)}
        >
            <PermissionCheckbox state={marcado ? "checked" : "unchecked"} onChange={onToggle} disabled={bloqueado} aria-label={role.nome} />
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <RoleChip cargo={role} permissionCount={contarPermissoes(role)} />
                </span>
                {role.descricao && <span className="mt-1 block truncate text-[11px] text-muted-foreground">{role.descricao}</span>}
            </span>
        </div>
    )

    if (!mensagemBloqueio) return linha

    return (
        <Tooltip>
            <TooltipTrigger asChild>{linha}</TooltipTrigger>
            <TooltipContent side="left">{mensagemBloqueio}</TooltipContent>
        </Tooltip>
    )
}

/** O coringa não tem contagem útil (`*` vale todas); sem lista, "não sei contar". */
function contarPermissoes(role: Pick<AssignableRole, "permissoes">): number | undefined {
    if (!role.permissoes) return undefined
    if (role.permissoes.includes("*")) return undefined
    return role.permissoes.length
}
