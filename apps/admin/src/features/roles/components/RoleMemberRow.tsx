"use client"

import { Lock, Minus, Plus, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { RoleMemberOption } from "../types"


interface MemberRowProps {
    usuario: RoleMemberOption
    selecionado: boolean
    disabled?: boolean
    immutable?: boolean
    actionDisabledReason?: string
    onAction: () => void
}

/** Uma linha dos painéis da aba Membros (copiado do Smart Desk). */
export function MemberRow({ usuario, selecionado, disabled, immutable, actionDisabledReason, onAction }: MemberRowProps) {
    const action =
        !disabled && !immutable ? (
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onAction}
                disabled={!!actionDisabledReason}
                aria-label={`${selecionado ? "Remover" : "Adicionar"} ${usuario.nome}`}
                className={cn(
                    "h-7 w-7 shrink-0",
                    selecionado ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "text-primary hover:bg-primary/10 hover:text-primary",
                )}
            >
                {selecionado ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
        ) : null

    return (
        <div
            className={cn(
                "flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors",
                selecionado
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 dark:border-gray-700",
            )}
        >
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{usuario.nome}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{usuario.email}</span>
            </span>


            {immutable && !disabled ? (
                <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground/60"
                    aria-label="Você não pode alterar os perfis deste usuário"
                    title="Você não pode alterar seus próprios perfis nem os de usuários fora da sua hierarquia"
                >
                    <Lock className="h-3.5 w-3.5" />
                </span>
            ) : actionDisabledReason && action ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="inline-flex" tabIndex={0}>
                            {action}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>{actionDisabledReason}</TooltipContent>
                </Tooltip>
            ) : (
                action
            )}
        </div>
    )
}

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder: string
    /** `aria-label` — os dois campos precisam de nomes distintos. */
    label: string
    disabled?: boolean
}

export function MemberSearchInput({ value, onChange, placeholder, label, disabled }: SearchInputProps) {
    return (
        <div className="relative h-10">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-50" />
            <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="pl-9" disabled={disabled} />
        </div>
    )
}

export function MemberEmptyState({ texto }: { texto: string }) {
    return (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-7 w-7 opacity-20" />
            <p className="text-sm">{texto}</p>
        </div>
    )
}

/** Casa por nome OU e-mail — homônimos são comuns, e o e-mail é o desempate. */
export function filtrarMembros(usuarios: RoleMemberOption[], busca: string): RoleMemberOption[] {
    const termo = busca.trim().toLowerCase()
    if (!termo) return usuarios
    return usuarios.filter((u) => u.nome?.toLowerCase().includes(termo) || u.email?.toLowerCase().includes(termo))
}
