"use client"

import { Lock } from "lucide-react"
import type { FieldErrors, UseFormRegister } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { RoleFormData } from "../../schemas/role.schema"
import { RoleColorSelect } from "../RoleColorSelect"

interface RoleGeneralTabProps {
    register: UseFormRegister<RoleFormData>
    errors: FieldErrors<RoleFormData>
    cor: string
    ativo: boolean
    onCorChange: (token: RoleFormData['cor']) => void
    onAtivoChange: (checked: boolean) => void
    /** Campos do perfil fora do alcance do usuário (somente leitura). */
    camposBloqueados: boolean
    salvando: boolean
    isAdminRole: boolean
}

const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="text-sm text-destructive">{message}</p> : null

/** Aba Geral do formulário de perfil (copiada do `RoleForm` do Smart Desk). */
export function RoleGeneralTab({
    register,
    errors,
    cor,
    ativo,
    onCorChange,
    onAtivoChange,
    camposBloqueados,
    salvando,
    isAdminRole,
}: RoleGeneralTabProps) {
    return (
        <>
            {isAdminRole && (
                <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        <strong>Administrador.</strong> Nome, descrição, cor e membros são editáveis. O perfil permanece
                        ativo, sem restrição de escopo e sempre concede acesso total.
                    </span>
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input id="nome" {...register("nome")} placeholder="Ex: Analista de Marketing" maxLength={60} disabled={camposBloqueados} />
                <FieldError message={errors.nome?.message} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                    id="descricao"
                    {...register("descricao")}
                    placeholder="O que este perfil permite fazer"
                    rows={2}
                    maxLength={500}
                    disabled={camposBloqueados}
                />
                <FieldError message={errors.descricao?.message} />
            </div>

            <div className="space-y-2">
                <Label>Cor *</Label>
                <RoleColorSelect value={cor} onChange={onCorChange} disabled={salvando || camposBloqueados} />
                <FieldError message={errors.cor?.message} />
            </div>

            {/*
             * Não há campo "Prioridade": a hierarquia é a ORDEM da lista de Perfis, definida
             * arrastando — como no Discord. Quem a escreve é `PUT /api/roles/reorder`.
             */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <div className="space-y-0.5">
                    <Label htmlFor="ativo">Ativo</Label>
                    <p className="text-sm text-muted-foreground">Perfis inativos não concedem permissões nem recebem novos membros</p>
                </div>
                <Switch
                    id="ativo"
                    checked={ativo}
                    onCheckedChange={onAtivoChange}
                    disabled={salvando || camposBloqueados || isAdminRole}
                />
            </div>
            <FieldError message={errors.ativo?.message} />

        </>
    )
}
