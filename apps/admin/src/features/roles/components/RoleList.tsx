"use client"

import { useCallback, useMemo, useState } from "react"
import { Plus, ShieldCheck } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { canManageRole, canReorderRole } from "@nandobfer/perfix"
import { CadastroHeader } from "@/components/list/CadastroHeader"
import { CadastroTableCard } from "@/components/list/CadastroTableCard"
import { CadastroTableSkeleton } from "@/components/list/CadastroTableSkeleton"
import { usePermissions } from "@/features/users/hooks/usePermissions"
import { Button } from "@/components/ui/button"
import { apiErrorMessage } from "@/lib/api"
import { useRoles } from "../hooks/useRoles"
import { useUrlFilters } from "@/hooks/useUrlFilters"
import { RoleFilters } from "./RoleFilters"
import { DEFAULT_ROLE_FILTERS, ROLE_FILTER_SCHEMA } from "../utils/role-filters"
import { RoleDeleteDialog } from "./RoleDeleteDialog"
import { RoleSortableTable } from "./RoleSortableTable"
import { ROLES_PATH } from "../constants"
import type { IRole } from "../types"

/**
 * Listagem de perfis (copiado do Smart Desk). NÃO PAGINA, de propósito: a ordem da lista É a
 * hierarquia e não há gesto para arrastar um perfil de uma página para outra.
 *
 * Definir perfis e reordenar seguem `canManageRole`/`canReorderRole` do `@nandobfer/perfix` (além
     * de `roles.edit`); sem essa autoridade a lista é só leitura, sem alça de arraste.
 */
export function RoleList() {
    const { can, cargos } = usePermissions()
    const navigate = useNavigate()
    const isReadOnly = !(can("roles.edit") && canManageRole(cargos, { permissoes: [] }))

    const [filtros, setFiltros, resetFiltros] = useUrlFilters(DEFAULT_ROLE_FILTERS, ROLE_FILTER_SCHEMA)
    const [roleToDelete, setRoleToDelete] = useState<IRole | null>(null)
    /** Ordem otimista enquanto o servidor não confirma, com a lista que a originou. */
    const [ordemLocal, setOrdemLocal] = useState<{ chave: string; ids: string[] } | null>(null)

    // Sem `page` nem `limit`: a rota trata `limit` ausente como "sem limite".
    const { roles: rolesDaApi = [], isLoading, error, refetch, reorderRoles } = useRoles({
        search: filtros.search || undefined,
        ativo: filtros.status.length === 1 ? filtros.status[0] === "ativo" : undefined,
    })
    // A lista não pagina. Reordenar um subconjunto filtrado é aceito pela API.
    const roles = rolesDaApi
    const total = roles.length

    /*
     * A ordem otimista carrega a assinatura da lista sobre a qual foi calculada: quando a lista
     * muda (filtro ou resposta do próprio reorder) ela deixa de casar e a tela volta à ordem do
     * servidor, sem efeito nenhum.
     */
    const idsDoServidor = roles.map((r) => r._id).join(",")

    const rolesOrdenados = useMemo(() => {
        if (!ordemLocal || ordemLocal.chave !== idsDoServidor) return roles
        const porId = new Map(roles.map((r) => [r._id, r]))
        return ordemLocal.ids.map((id) => porId.get(id)).filter((r): r is IRole => r !== undefined)
    }, [roles, ordemLocal, idsDoServidor])

    const podeReordenarCargo = useCallback(
        (role: IRole) => !isReadOnly && canReorderRole(cargos, { permissoes: role.permissoes ?? [] }),
        [cargos, isReadOnly],
    )

    const handleReorder = (proxima: string[]) => {
        setOrdemLocal({ chave: idsDoServidor, ids: proxima })
        reorderRoles.mutate(proxima.filter(id => roles.some(role => role._id === id && podeReordenarCargo(role))), {
            onError: (err) => {
                // O servidor recusa, por exemplo, tirar o Administrador do topo: volta à ordem dele.
                setOrdemLocal(null)
                toast.error(apiErrorMessage(err, "Erro ao reordenar perfis"))
            },
        })
    }

    if (error) {
        return (
            <div className="rounded-lg border border-destructive p-6 text-center">
                <p className="text-destructive">Erro ao carregar perfis: {apiErrorMessage(error, error.message)}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
                    Tentar novamente
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <CadastroHeader
                title="Cadastro de Perfis"
                description="Perfis concedem permissões. Um usuário pode ter mais de um — as permissões se somam."
                actionLabel={isReadOnly ? undefined : "Novo Perfil"}
                onAction={isReadOnly ? undefined : () => navigate(`${ROLES_PATH}/novo`)}
                actionIcon={<Plus size={18} />}
            />

            <RoleFilters values={filtros} onChange={setFiltros} onClear={resetFiltros} total={total} />

            <CadastroTableCard>
                {isLoading ? (
                    <CadastroTableSkeleton columns={5} />
                ) : roles.length > 0 ? (
                    <>
                        <RoleSortableTable
                            roles={rolesOrdenados}
                            mostrarOrdem={!isReadOnly}
                            podeReordenar={podeReordenarCargo}
                            onReorder={handleReorder}
                            onEdit={(role) => navigate(`${ROLES_PATH}/${role._id}`)}
                            onDelete={setRoleToDelete}
                        />

                        <div className="mt-4 border-t pt-4">
                            <p className="text-sm text-muted-foreground">
                                Total: {total} {total === 1 ? "perfil" : "perfis"}
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="py-12 text-center text-muted-foreground">
                        <ShieldCheck className="mx-auto mb-4 h-12 w-12 opacity-20" />
                        <h3 className="text-lg font-medium">Nenhum perfil encontrado</h3>
                        <p className="text-sm">Tente ajustar os filtros para encontrar o que procura.</p>
                    </div>
                )}
            </CadastroTableCard>

            <RoleDeleteDialog role={roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)} />
        </div>
    )
}
