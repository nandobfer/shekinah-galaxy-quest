"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Users } from "lucide-react"
import { CadastroHeader } from "@/components/list/CadastroHeader"
import { useUrlFilters } from "@/hooks/useUrlFilters"
import { CadastroTableCard } from "@/components/list/CadastroTableCard"
import { CadastroTableSkeleton } from "@/components/list/CadastroTableSkeleton"
import { StatusPill } from "@/components/list/StatusPill"
import { TableAction } from "@/components/list/TableAction"
import { EmptyState } from "@/components/feedback/EmptyState"
import { ErrorState } from "@/components/feedback/ErrorState"
import { listContainer, listItem } from "@/components/motion/presets"
import { usePermissions } from "../hooks/usePermissions"
import { useAdminUsers, useDeleteUser } from "../hooks/useUsersAdmin"
import { UserDeleteDialog } from "./UserDeleteDialog"
import { RoleChip } from "@/features/roles/components/permissions/RoleChip"
import type { AdminUserDto } from "@shekinah/contracts"
import { UserFormDialog } from "./UserFormDialog"
import { UserFilters } from "./UserFilters"
import { DEFAULT_USER_FILTERS, USER_FILTER_SCHEMA, filterUsers, profileOptions } from "../utils/user-filters"

const HIERARCHY_REASON = "Este usuário está acima do seu perfil."
const TH = "text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground"

export function UserList() {
    const { can, userId } = usePermissions()
    const { data: users = [], isLoading, isError, refetch } = useAdminUsers()
    const [filters, setFilters, resetFilters] = useUrlFilters(DEFAULT_USER_FILTERS, USER_FILTER_SCHEMA)
    const [editing, setEditing] = useState<AdminUserDto | null>(null)
    const [open, setOpen] = useState(false)
    const [deleting, setDeleting] = useState<AdminUserDto | undefined>(undefined)
    const deleteUser = useDeleteUser()

    const filtered = useMemo(() => filterUsers(users, filters), [users, filters])
    const profiles = useMemo(() => profileOptions(users), [users])
    const hasFilters = filters.search.trim() !== "" || filters.perfis.length + filters.status.length > 0

    const openDialog = (user: AdminUserDto | null) => {
        setEditing(user)
        setOpen(true)
    }

    return (
        <div className="flex flex-col gap-6">
            <CadastroHeader
                title="Usuários"
                description="Perfis concedem permissões. Um usuário pode ter mais de um — as permissões se somam."
            />
            <UserFilters
                values={filters}
                onChange={setFilters}
                onClear={resetFilters}
                total={filtered.length}
                profiles={profiles}
            />
            <CadastroTableCard>
                {isLoading ? (
                    <CadastroTableSkeleton columns={5} rows={6} />
                ) : isError ? (
                    <ErrorState onRetry={() => void refetch()} />
                ) : filtered.length === 0 ? (
                    <EmptyState icon={Users} title={hasFilters ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"} />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className={TH}>Usuário</th>
                                    <th className={TH}>Perfis</th>
                                    <th className={`${TH} w-28`}>Status</th>
                                    {can("users.edit") && <th className={`${TH} w-28 text-right`}>Ações</th>}
                                </tr>
                            </thead>
                            <motion.tbody variants={listContainer} initial="hidden" animate="visible">
                                <AnimatePresence initial={false}>
                                    {filtered.map((user) => (
                                        <motion.tr key={user.id} variants={listItem} exit="exit" className="border-b hover:bg-muted/50">
                                            <td className="max-w-0 p-3">
                                                <p className="truncate text-sm font-medium">{user.nome}</p>
                                                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {user.cargos.map((role) => (
                                                        <RoleChip key={role.id} cargo={role} />
                                                    ))}
                                                    {user.cargos.length === 0 && <span className="text-xs text-muted-foreground">Sem perfil</span>}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <StatusPill active={user.ativo} />
                                            </td>
                                            {can("users.edit") && (
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <TableAction
                                                            type="edit"
                                                            onClick={() => openDialog(user)}
                                                            disabled={!user.gerenciavel}
                                                            disabledReason={user.gerenciavel ? undefined : HIERARCHY_REASON}
                                                        />
                                                        <TableAction
                                                            type="delete"
                                                            onClick={() => setDeleting(user)}
                                                            disabled={user.id === userId || !user.gerenciavel}
                                                            disabledReason={user.id === userId ? "Você não pode excluir sua própria conta." : user.gerenciavel ? undefined : HIERARCHY_REASON}
                                                        />
                                                    </div>
                                                </td>
                                            )}
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </motion.tbody>
                        </table>
                    </div>
                )}
            </CadastroTableCard>
            <UserFormDialog open={open} user={editing} isSelf={editing?.id === userId} onOpenChange={setOpen} />
            <UserDeleteDialog
                open={!!deleting}
                onOpenChange={(next) => !next && setDeleting(undefined)}
                user={deleting}
                isDeleting={deleteUser.isPending}
                onConfirm={async () => {
                    // Otimista: a linha sai na hora; em falha volta com toast (useDeleteUser).
                    if (deleting) await deleteUser.mutateAsync({ id: deleting.id, version: deleting.version })
                }}
            />
        </div>
    )
}
