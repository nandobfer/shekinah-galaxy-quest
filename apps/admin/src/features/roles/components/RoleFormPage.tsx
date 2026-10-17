"use client"

import { Loader2 } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { RoleForm } from "./RoleForm"
import { useRole } from "../hooks/useRoles"

import { ROLES_PATH } from "../constants"

/** Página de criação/edição de perfil (copiado do Smart Desk). */
export function RoleFormPage({ create = false }: { create?: boolean }) {
    const navigate = useNavigate()
    const params = useParams()
    const roleId = create ? undefined : params.roleId
    const { data: role, isLoading, error } = useRole(roleId)

    if (roleId && isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center" role="status">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="sr-only">Carregando perfil...</span>
            </div>
        )
    }

    if (roleId && (error || !role)) {
        return <p className="rounded-lg border border-destructive p-6 text-destructive">Perfil não encontrado.</p>
    }

    return <RoleForm key={roleId ?? 'new'} role={roleId ? role : undefined} onCancel={() => navigate(ROLES_PATH)} />
}
