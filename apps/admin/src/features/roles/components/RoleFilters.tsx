"use client"

import { Shield } from "lucide-react"
import { FilterGroup } from "@/components/list/FilterGroup"
import { CadastroMultiSelect } from "@/components/list/CadastroMultiSelect"
import { ListFilters } from "@/components/list/ListFilters"
import { StatusPill } from "@/components/list/StatusPill"
import { type RoleFiltersValues, type RoleStatus } from "../utils/role-filters"

interface RoleFiltersProps {
    values: RoleFiltersValues
    onChange: (values: RoleFiltersValues) => void
    onClear: () => void
    total: number
}

const STATUS_OPTIONS: { value: RoleStatus; label: string }[] = [
    { value: "ativo", label: "Ativos" },
    { value: "inativo", label: "Inativos" },
]

/** Filtros da lista de perfis (padrão `ListFilters`, estado na URL): busca, Status e Escopos. */
export function RoleFilters({ values, onChange, onClear, total }: RoleFiltersProps) {
    return (
        <ListFilters
            total={total}
            onClear={onClear}
            search={{ value: values.search, onChange: (search) => onChange({ ...values, search }), placeholder: "Nome ou descrição..." }}
        >
            <FilterGroup label="Status" className="min-w-[150px] flex-1">
                <CadastroMultiSelect
                    selected={values.status}
                    onSelect={(status) => onChange({ ...values, status: status as RoleStatus[] })}
                    options={STATUS_OPTIONS}
                    placeholder="Todos"
                    icon={Shield}
                    renderLabel={(option) => <StatusPill active={option.value === "ativo"} />}
                />
            </FilterGroup>
        </ListFilters>
    )
}
