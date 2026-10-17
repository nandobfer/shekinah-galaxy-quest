"use client"

import type { HTMLAttributes } from "react"
import { GripVertical, Lock, Users } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { StatusPill } from "@/components/list/StatusPill"
import { TableAction } from "@/components/list/TableAction"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { WILDCARD } from "@/lib/permissions/catalog"
import { ADMIN_ROLE_SLUG } from "@/lib/permissions/bootstrap-roles"
import { RoleChip } from "./permissions/RoleChip"
import { PermissionSummary } from "./permissions/PermissionSummary"
import type { IRole } from "../types"

interface RoleCellsProps {
    role: IRole
    mostrarOrdem: boolean
    arrastavel: boolean
    /** Só na cópia do `DragOverlay`: fora da tabela não há colunas de onde herdar medida. */
    larguras?: number[]
    alcaProps?: HTMLAttributes<HTMLButtonElement>
    arrastando?: boolean
    onEdit?: () => void
    onDelete?: () => void
}

/**
 * As células do perfil, sem o `<tr>` (copiado do Smart Desk). Renderizadas em DOIS lugares: na
 * linha sortable e na cópia que flutua no `DragOverlay` — que não pode chamar `useSortable`.
 */
export function RoleCells({ role, mostrarOrdem, arrastavel, larguras, alcaProps, arrastando, onEdit, onDelete }: RoleCellsProps) {
    const largura = (indice: number) => (larguras ? { width: larguras[indice] } : undefined)
    // Sem a alça, a primeira coluna de dado é a 0.
    const desloca = mostrarOrdem ? 1 : 0
    const membros = role.usuariosCount ?? 0

    return (
        <>
            {/* `p-0` na célula e padding no botão: a área de "segurar" é a célula inteira. */}
            {mostrarOrdem && (
                <td className={cn("p-0", arrastavel && "cursor-grab")} style={largura(0)}>
                    {arrastavel ? (
                        <button
                            type="button"
                            aria-label={`Reordenar ${role.nome}`}
                            onClick={(event) => event.stopPropagation()}
                            className={cn(
                                "flex h-full w-full touch-none items-center justify-center p-3 text-muted-foreground/50 transition-colors hover:text-muted-foreground",
                                "cursor-grab hover:cursor-grab active:cursor-grabbing",
                                // Sufixo `!` (Tailwind v4) segura o cursor fechado durante o arraste.
                                arrastando && "cursor-grabbing!",
                            )}
                            {...alcaProps}
                        >
                            <GripVertical size={16} />
                        </button>
                    ) : (
                        <span
                            className="flex h-full w-full items-center justify-center p-3 text-muted-foreground/35"
                            aria-label={`Posição protegida de ${role.nome}`}
                            title="Você só pode reordenar perfis abaixo do seu perfil mais alto"
                        >
                            <Lock size={14} />
                        </span>
                    )}
                </td>
            )}
            <td className="p-3 text-center" style={largura(desloca)}>
                <StatusPill active={role.ativo} />
            </td>
            <td className="p-3" style={largura(desloca + 1)}>
                <div className="flex items-center gap-2">
                    <RoleChip cargo={role} />
                </div>
                {role.descricao && <p className="mt-0.5 text-[11px] text-muted-foreground">{role.descricao}</p>}
            </td>
            <td className="p-3" style={largura(desloca + 2)}>
                <PermissionCount role={role} />
            </td>
            <td className="p-3" style={largura(desloca + 3)}>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users size={12} className="text-primary/70" />
                    <span className="text-xs font-semibold tabular-nums">{membros}</span>
                    <span className="text-xs">{membros === 1 ? "usuário" : "usuários"}</span>
                </div>
            </td>
            <td className="p-3" style={largura(desloca + 4)}>
                {!arrastando && onEdit && onDelete && (
                    <div className="flex items-center justify-center">
                        <TableAction type="edit" onClick={onEdit} />
                        <TableAction
                            type="delete"
                            onClick={onDelete}
                            disabled={role.slug === ADMIN_ROLE_SLUG || membros > 0}
                            disabledReason={
                                role.slug === ADMIN_ROLE_SLUG
                                    ? "O perfil Administrador não pode ser excluído"
                                    : membros > 0
                                      ? "Este perfil possui membros associados"
                                      : undefined
                            }
                        />
                    </div>
                )}
            </td>
        </>
    )
}

interface RoleSortableRowProps {
    role: IRole
    mostrarOrdem: boolean
    arrastavel: boolean
    onEdit: () => void
    onDelete: () => void
}

/**
 * Linha sortable. Durante o arraste fica invisível ocupando o lugar (o vão que anda pela lista) e
 * quem segue o ponteiro é a cópia no `DragOverlay`. `CSS.Translate`, NUNCA `CSS.Transform`: a
 * escala derivada achataria linhas de alturas diferentes.
 */
export function RoleSortableRow({ role, mostrarOrdem, arrastavel, onEdit, onDelete }: RoleSortableRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: role._id, disabled: !arrastavel })

    return (
        <tr
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={cn("border-b transition-colors hover:bg-muted/50", isDragging && "opacity-0")}
        >
            <RoleCells
                role={role}
                mostrarOrdem={mostrarOrdem}
                arrastavel={arrastavel}
                arrastando={isDragging}
                alcaProps={{ ...attributes, ...listeners } as HTMLAttributes<HTMLButtonElement>}
                onEdit={onEdit}
                onDelete={onDelete}
            />
        </tr>
    )
}

/** Contagem com o resumo por módulo no tooltip. O coringa não tem número — tem "todas". */
function PermissionCount({ role }: { role: IRole }) {
    const selected = new Set(role.permissoes ?? [])

    if (selected.has(WILDCARD)) {
        return <span className="text-xs font-semibold text-red-700 dark:text-red-400">todas</span>
    }

    return (
        <TooltipProvider>
            <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                    <span className="cursor-default text-xs font-semibold tabular-nums">{selected.size}</span>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[320px]">
                    <PermissionSummary selected={selected} variant="compact" maxModules={6} />
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
