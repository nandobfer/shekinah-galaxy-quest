"use client"

import { useMemo, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useRoleMemberOptions } from "../hooks/useRoleMemberOptions"
import type { RoleMemberOption } from "../types"
import { MemberEmptyState, MemberRow, MemberSearchInput, filtrarMembros } from "./RoleMemberRow"

interface RoleMembersPanelProps {
    /** Ids dos usuários membros. É a lista COMPLETA, não um delta. */
    value: string[]
    onChange: (userIds: string[]) => void
    /** Usuários que permanecem visíveis, mas não podem entrar nem sair do perfil. */
    immutableUserIds?: string[]
    disabled?: boolean
    /** Explica por que a edição está bloqueada, quando está. */
    disabledReason?: string
    /** Bloqueia somente novas entradas; membros atuais ainda podem ser removidos. */
    additionsDisabled?: boolean
    additionsDisabledReason?: string
}

const PANEL_NOTE = "rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-muted-foreground dark:border-gray-700 dark:bg-gray-800/50"

/**
 * Membros de um perfil, em dois painéis lado a lado (copiado do Smart Desk): quem já é membro e
 * quem pode ser adicionado. Totalmente controlado — a lista pertence ao formulário, que a envia
 * para `PUT /api/roles/[id]/members`.
 */
export function RoleMembersPanel({
    value,
    onChange,
    immutableUserIds = [],
    disabled,
    disabledReason,
    additionsDisabled,
    additionsDisabledReason,
}: RoleMembersPanelProps) {
    // Uma busca por painel: um campo único esconderia membros atuais pelo termo de quem adicionar.
    const [buscaMembros, setBuscaMembros] = useState("")
    const [buscaDisponiveis, setBuscaDisponiveis] = useState("")
    const { usuarios, isLoading } = useRoleMemberOptions()

    const selecionados = useMemo(() => new Set(value), [value])
    const imutaveis = useMemo(() => new Set(immutableUserIds), [immutableUserIds])
    const membros = useMemo(() => usuarios.filter((u) => selecionados.has(u._id)), [usuarios, selecionados])
    const membrosFiltrados = useMemo(() => filtrarMembros(membros, buscaMembros), [membros, buscaMembros])
    const disponiveis = useMemo(
        () => filtrarMembros(usuarios.filter((u) => !selecionados.has(u._id)), buscaDisponiveis),
        [usuarios, selecionados, buscaDisponiveis],
    )


    const adicionar = (usuario: RoleMemberOption) => {
        if (disabled || additionsDisabled || imutaveis.has(usuario._id)) return
        onChange([...value, usuario._id])
    }

    const remover = (userId: string) => {
        if (disabled || imutaveis.has(userId)) return
        onChange(value.filter((id) => id !== userId))
    }

    if (isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 rounded-lg" />
                ))}
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className="space-y-3">
                {disabled && disabledReason && <p className={PANEL_NOTE}>{disabledReason}</p>}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <section className="space-y-2">
                        <header className="flex h-6 items-center justify-between">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Membros do perfil</h3>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">{membros.length}</span>
                        </header>

                        <MemberSearchInput value={buscaMembros} onChange={setBuscaMembros} placeholder="Buscar entre os membros..." label="Buscar membro" disabled={disabled} />

                        {membros.length === 0 ? (
                            <MemberEmptyState texto="Nenhum membro ainda. Adicione ao lado." />
                        ) : membrosFiltrados.length === 0 ? (
                            <MemberEmptyState texto="Nenhum membro encontrado para esta busca." />
                        ) : (
                            <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
                                {membrosFiltrados.map((usuario) => (
                                    <MemberRow
                                        key={usuario._id}
                                        usuario={usuario}
                                        selecionado
                                        disabled={disabled}
                                        immutable={imutaveis.has(usuario._id)}
                                        onAction={() => remover(usuario._id)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="space-y-2">
                        <header className="flex h-6 items-center">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adicionar membros</h3>
                        </header>

                        <MemberSearchInput
                            value={buscaDisponiveis}
                            onChange={setBuscaDisponiveis}
                            placeholder="Buscar por nome ou e-mail..."
                            label="Buscar usuário"
                            disabled={disabled || additionsDisabled}
                        />

                        {!disabled && additionsDisabled && additionsDisabledReason && <p className={PANEL_NOTE}>{additionsDisabledReason}</p>}

                        {disponiveis.length === 0 ? (
                            <MemberEmptyState
                                texto={buscaDisponiveis.trim() ? "Nenhum usuário encontrado para esta busca." : "Todos os usuários já são membros deste perfil."}
                            />
                        ) : (
                            <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
                                {disponiveis.map((usuario) => (
                                    <MemberRow
                                        key={usuario._id}
                                        usuario={usuario}
                                        selecionado={false}
                                        disabled={disabled || additionsDisabled}
                                        immutable={imutaveis.has(usuario._id)}
                                        onAction={() => adicionar(usuario)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </TooltipProvider>
    )
}
