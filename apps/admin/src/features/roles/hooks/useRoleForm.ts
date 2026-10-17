"use client"

import { useEffect, useRef } from "react"
import { useForm, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { catalog, WILDCARD } from "@/lib/permissions/catalog"
import { ADMIN_ROLE_SLUG } from "@/lib/permissions/bootstrap-roles"
import { roleSchema, type RoleFormData } from "../schemas/role.schema"
import type { IRole } from "../types"
import { useRoles } from "./useRoles"

interface UseRoleFormProps {
    role?: IRole // modo edição
    onSuccess?: () => void | Promise<void>
    onError?: (error: Error) => void
    getMembers?: () => string[] | undefined
}

const defaultRoleData: RoleFormData = {
    nome: "",
    descricao: "",
    cor: "cinza",
    permissoes: [],
    escopos: [],
    ativo: true,
}

/**
 * Descarta chave que não existe mais no catálogo: a `PermissionTree` itera o catálogo, então uma
 * chave órfã seria invisível e deixaria o perfil insalvável.
 */
function apenasChavesConhecidas(permissoes: readonly string[]): string[] {
    return permissoes.filter((key) => key === WILDCARD || catalog.isKnownKey(key))
}

/**
 * Formulário de perfil: react-hook-form + o mesmo schema Zod da API (copiado do Smart Desk).
 * Permissões são editadas pela árvore, lidas com watch e escritas com setValue;
 * escopos permanecem vazios neste aplicativo.
 */
export function useRoleForm({ role: incomingRole, onSuccess, onError, getMembers }: UseRoleFormProps = {}) {
    // Preserve the editor's base version and draft across background refetches.
    const role = useRef(incomingRole).current
    const { createRole, updateRole } = useRoles()

    const form = useForm<RoleFormData>({
        resolver: zodResolver(roleSchema),
        defaultValues: defaultRoleData,
    })

    const onSubmit = async (data: RoleFormData) => {
        try {
            if (role) {
                const update = role.slug === ADMIN_ROLE_SLUG ? { nome: data.nome, descricao: data.descricao, cor: data.cor } : data
                await updateRole.mutateAsync({ id: role._id, data: { ...update, membros: getMembers?.() }, version: role.version })
            } else {
                await createRole.mutateAsync(data)
                form.reset(defaultRoleData)
            }

            await onSuccess?.()
        } catch (error) {
            onError?.(error as Error)
        }
    }

    useEffect(() => {
        form.reset(
            role
                ? {
                      nome: role.nome,
                      descricao: role.descricao || "",
                      cor: role.cor as RoleFormData['cor'],
                      permissoes: apenasChavesConhecidas(role.permissoes ?? []),
                      escopos: [],
                      ativo: role.ativo,
                  }
                : defaultRoleData,
        )
    }, [role, form])

    /** Sem este segundo argumento a validação falha MUDA: sem toast, o clique parece não fazer nada. */
    const onInvalid = (errors: FieldErrors<RoleFormData>) => {
        const firstError = Object.values(errors).find((error) => error && "message" in error && typeof error.message === "string")
        toast.error(firstError?.message ?? "Verifique os campos destacados")
    }

    return {
        ...form,
        onSubmit: form.handleSubmit(onSubmit, onInvalid),
        isSubmitting: createRole.isPending || updateRole.isPending,
        isEditMode: !!role,
    }
}
