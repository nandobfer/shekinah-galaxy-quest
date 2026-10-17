"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getColor } from "@/lib/constants/color-palette"

interface RoleFormHeaderProps {
    nome: string
    cor: string
    onBack: () => void
}

/**
 * Cabeçalho do formulário de perfil (copiado do `RoleForm` do Smart Desk). O título É o nome do
 * perfil, na cor dele — que acompanha o seletor de cor em tempo real. A cor vem do TOKEN via
 * `getColor`, nunca de hex guardado.
 */
export function RoleFormHeader({ nome, cor, onBack }: RoleFormHeaderProps) {
    const corDoPerfil = getColor(cor)

    return (
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Voltar para perfis" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="flex min-w-0 items-center gap-2.5 text-xl font-semibold">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corDoPerfil.hex }} />
                <span className="truncate" style={{ color: corDoPerfil.hex }}>
                    {nome || "Novo Perfil"}
                </span>
            </h1>
        </div>
    )
}
