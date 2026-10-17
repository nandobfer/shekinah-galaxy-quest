"use client"

import { AlertTriangle } from "lucide-react"
import type { FieldErrors } from "react-hook-form"
import type { RoleFormData } from "../../schemas/role.schema"
import { PermissionTree } from "../permissions/PermissionTree"

interface RolePermissionsTabProps {
    selecionadas: ReadonlySet<string>
    onChange: (next: Set<string>) => void
    readOnly: boolean
    errors: FieldErrors<RoleFormData>
    /** Membros atuais do perfil (para o aviso de impacto). */
    usuariosCount: number
    /** Permissões que os membros PERDEM ao salvar. */
    removidas: number
}

/** Aba Permissões do formulário de perfil (copiada do `RoleForm` do Smart Desk). */
export function RolePermissionsTab({ selecionadas, onChange, readOnly, errors, usuariosCount, removidas }: RolePermissionsTabProps) {
    const mostrarImpacto = usuariosCount > 0 && removidas > 0

    return (
        <>
            {mostrarImpacto && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        <strong>
                            {usuariosCount} membro
                            {usuariosCount === 1 ? "" : "s"}
                        </strong>{" "}
                        {/* Palavra inteira no ternário: o acento MUDA de lugar no plural ("perderá" → "perderão"). */}
                        {usuariosCount === 1 ? "perderá" : "perderão"}{" "}
                        <strong>
                            {removidas} permiss
                            {removidas === 1 ? "ão" : "ões"}
                        </strong>{" "}
                        ao salvar.
                    </span>
                </div>
            )}

            <PermissionTree selected={selecionadas} onChange={onChange} readOnly={readOnly} />

            {/* `errors.permissoes.message` só existe em erro do ARRAY (ex.: o `.max(200)`). Erro de
                ITEM mora em `errors.permissoes[i]`, sem `.message` no objeto de fora — daí o fallback. */}
            {errors.permissoes && (
                <p className="text-sm text-destructive">{errors.permissoes.message ?? "Uma ou mais permissões são inválidas."}</p>
            )}
        </>
    )
}
