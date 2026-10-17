"use client"

import type { UseFormReturn } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { RoleChip } from "@/features/roles/components/permissions/RoleChip"
import type { UserInput } from "../schemas"

interface UserGeneralTabProps {
    form: UseFormReturn<UserInput>
    isSelf: boolean
    selectedRoles: { id: string; nome: string; cor: string }[]
    onGoToRoles: () => void
}

/** Aba "Geral" do formulário de usuário (layout do Smart Desk, campos do CRM). */
export function UserGeneralTab({ form, isSelf, selectedRoles, onGoToRoles }: UserGeneralTabProps) {
    const { register, setValue, watch, formState } = form
    const ativo = watch("ativo")
    const errors = formState.errors

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
                <div className="space-y-0.5">
                    <Label htmlFor="user-ativo" className="cursor-pointer text-sm font-bold">
                        Status do Usuário
                    </Label>
                    <p className="text-[10px] uppercase tracking-tight text-muted-foreground">
                        {isSelf ? "Você não pode desativar o próprio usuário" : "Ative ou desative o acesso"}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={cn("text-[10px] font-bold uppercase", ativo ? "text-emerald-500" : "text-red-500")}>{ativo ? "Ativo" : "Inativo"}</span>
                    <Switch
                        id="user-ativo"
                        checked={ativo}
                        disabled={isSelf || formState.isSubmitting}
                        onCheckedChange={(checked) => setValue("ativo", checked, { shouldDirty: true })}
                    />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="user-nome">
                        Nome <span className="text-destructive">*</span>
                    </Label>
                    <Input id="user-nome" {...register("nome")} placeholder="Nome completo do usuário" disabled={formState.isSubmitting} />
                    {errors.nome && <p className="mt-1 text-xs font-medium text-destructive">{errors.nome.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="user-email">
                        E-mail <span className="text-destructive">*</span>
                    </Label>
                    <Input id="user-email" type="email" disabled {...register("email")} placeholder="email@exemplo.com" />
                    {errors.email && <p className="mt-1 text-xs font-medium text-destructive">{errors.email.message}</p>}
                </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Perfis</Label>
                {/* `cursor-default`: aqui os chips são só leitura, e o RoleChip herda o cursor do container. */}
                <div className="flex cursor-default flex-wrap items-center gap-1.5">
                    {selectedRoles.length === 0 ? (
                        <span className="text-xs italic text-muted-foreground">Nenhum perfil — o usuário não terá acesso a nada.</span>
                    ) : (
                        selectedRoles.map((role) => <RoleChip key={role.id} cargo={role} />)
                    )}
                    <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onGoToRoles}>
                        {isSelf ? "Ver na aba Perfis" : "Alterar na aba Perfis"}
                    </Button>
                </div>
            </div>

        </div>
    )
}
