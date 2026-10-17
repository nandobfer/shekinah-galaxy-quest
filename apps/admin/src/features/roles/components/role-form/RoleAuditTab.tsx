"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { motion } from "framer-motion"
import { Label } from "@/components/ui/label"
import { tabMotionProps } from "@/lib/tab-motion"
import type { IRole } from "../../types"

const formatDate = (date?: string | null) => (date ? format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-")

function AuditField({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">{label}</Label>
            <p className="mt-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300">{value}</p>
        </div>
    )
}

/**
 * Aba "Log de Auditoria" do perfil — o `AuditLogTab` do Smart Desk com `showFooter={false}` (o
 * formulário de perfil tem rodapé próprio). Os nomes vêm resolvidos de `GET /api/roles/[id]`.
 */
export function RoleAuditTab({ role }: { role: IRole }) {
    return (
        <motion.div {...tabMotionProps} className="space-y-4 pt-4">
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800/50">
                <div className="grid grid-cols-2 gap-4">
                    <AuditField label="Criado Por" value={role.createdByNome ?? "-"} />
                    <AuditField label="Criado Em" value={formatDate(role.createdAt)} />
                </div>

                {role.updatedBy && (
                    <div className="grid grid-cols-2 gap-4">
                        <AuditField label="Atualizado Por" value={role.updatedByNome ?? "-"} />
                        <AuditField label="Atualizado Em" value={formatDate(role.updatedAt)} />
                    </div>
                )}
            </div>
        </motion.div>
    )
}
