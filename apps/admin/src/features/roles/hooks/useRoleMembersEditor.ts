"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { apiErrorMessage } from "@/lib/api"
import type { IRole } from "../types"
import { useRoles } from "./useRoles"
import { useRoleMemberOptions } from "./useRoleMemberOptions"

/**
 * Estado da aba Membros do formulário de perfil (extraído do `RoleForm` do Smart Desk).
 *
 * Membros só em edição. O formulário usa PATCH atômico de perfil+membros no NestJS;
 * a ação independente usa PUT /roles/:id/members, também com versão e users.edit.
 */
export function useRoleMembersEditor(role?: IRole) {
    const { updateMembers } = useRoles()
    const { usuarios, membrosAtuais, isLoading } = useRoleMemberOptions(role?._id)
    const [membros, setMembros] = useState<string[]>([])
    const membrosCarregados = useRef(false)

    // Carrega os membros UMA vez por abertura. Sem a trava, um refetch de fundo da lista de
    // usuários (a invalidação de `["admin-users"]` dispara um) descartaria a edição em andamento.
    useEffect(() => {
        if (membrosCarregados.current || isLoading) return

        setMembros(membrosAtuais)
        membrosCarregados.current = true
    }, [membrosAtuais, isLoading])

    const membrosMudaram = useMemo(() => {
        if (membros.length !== membrosAtuais.length) return true
        const atuais = new Set(membrosAtuais)
        return membros.some((id) => !atuais.has(id))
    }, [membros, membrosAtuais])

    const salvarMembros = useCallback(async (version = role?.version) => {
        if (!role || !membrosMudaram) return true

        try {
            await updateMembers.mutateAsync({ id: role._id, membros, version: version ?? role.version })
            return true
        } catch (error: unknown) {
            toast.error(apiErrorMessage(error, "Os membros não foram atualizados"))
            return false
        }
    }, [role, membrosMudaram, membros, updateMembers])

    /**
     * Ao desativar o perfil, elimina somente inclusões ainda não salvas. Remoções feitas na mesma
     * edição permanecem no estado e poderão limpar os vínculos existentes.
     */
    const descartarInclusoes = useCallback(() => {
        const atuais = new Set(membrosAtuais)
        setMembros((selecionados) => selecionados.filter((id) => atuais.has(id)))
    }, [membrosAtuais])

    return {
        usuarios,
        membros,
        setMembros,
        membrosMudaram,
        salvarMembros,
        descartarInclusoes,
        isSaving: updateMembers.isPending,
    }
}
