"use client"

import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiErrorMessage } from "@/lib/api"
import { useRoles } from "../hooks/useRoles"
import type { IRole } from "../types"

interface RoleDeleteDialogProps {
    role: IRole | null
    onOpenChange: (open: boolean) => void
}

/** Confirmação explícita de exclusão (copiado do Smart Desk). */
export function RoleDeleteDialog({ role, onOpenChange }: RoleDeleteDialogProps) {
    const { deleteRole } = useRoles()

    const handleDelete = async () => {
        if (!role) return
        try {
            await deleteRole.mutateAsync(role._id)
            toast.success(`Perfil "${role.nome}" excluído com sucesso`)
            onOpenChange(false)
        } catch (error: unknown) {
            toast.error(apiErrorMessage(error, "Não foi possível excluir o perfil"))
        }
    }

    return (
        <AlertDialog open={Boolean(role)} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir perfil?</AlertDialogTitle>
                    <AlertDialogDescription>O perfil {role ? `“${role.nome}”` : "selecionado"} será excluído permanentemente.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteRole.isPending}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={(event) => {
                            event.preventDefault()
                            void handleDelete()
                        }}
                        disabled={deleteRole.isPending}
                    >
                        {deleteRole.isPending ? "Excluindo..." : "Excluir perfil"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
