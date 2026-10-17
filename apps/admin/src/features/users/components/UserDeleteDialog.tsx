"use client"

import { motion } from "framer-motion"
import { AlertTriangle, Loader2 } from "lucide-react"
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
import { dialogPanelMotion } from "@/lib/dialog-panel-motion"

interface UserDeleteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user?: { nome: string; pendente?: boolean }
    onConfirm: () => Promise<void>
    isDeleting?: boolean
}

/** Confirmação de exclusão definitiva de usuário (copiada do Smart Desk). */
export function UserDeleteDialog({ open, onOpenChange, user, onConfirm, isDeleting }: UserDeleteDialogProps) {
    if (!user) return null

    const handleConfirm = async () => {
        try { await onConfirm(); onOpenChange(false) } catch { /* Mutation displays the error; leave confirmation open to retry. */ }
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-lg overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-2xl">
                <motion.div {...dialogPanelMotion}>
                    <AlertDialogHeader className="border-b border-border px-6 py-4">
                        <AlertDialogTitle className="flex items-center gap-2 text-lg font-semibold">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Excluir Usuário
                        </AlertDialogTitle>
                        {/* `asChild`: o Description do Radix é um <p>; <p> dentro de <p> quebra a hidratação. */}
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p>
                                    Tem certeza que deseja excluir o usuário <span className="font-semibold text-foreground">{user.nome}</span>?
                                    {user.pendente ? " O convite pendente será revogado." : " A conta de acesso será removida."}
                                </p>
                                <p className="text-destructive">Esta ação não pode ser desfeita.</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="border-t border-border px-6 py-4">
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault()
                                void handleConfirm()
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </motion.div>
            </AlertDialogContent>
        </AlertDialog>
    )
}
