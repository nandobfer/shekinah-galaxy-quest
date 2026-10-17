"use client"

import { ShieldCheck, UserCheck } from "lucide-react"
import { CadastroMultiSelect } from "@/components/list/CadastroMultiSelect"
import { FilterGroup } from "@/components/list/FilterGroup"
import { ListFilters } from "@/components/list/ListFilters"
import { StatusPill } from "@/components/list/StatusPill"
import type { UserFiltersValues, UserStatus } from "../utils/user-filters"

interface Option {
    value: string
    label: string
}

interface UserFiltersProps {
    values: UserFiltersValues
    onChange: (values: UserFiltersValues) => void
    onClear: () => void
    total: number
    profiles: Option[]
}

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
    { value: "ativo", label: "Ativos" },
    { value: "inativo", label: "Inativos" },
]

/** Filtros da lista de usuários: busca (wrapper) + Perfis, Empresas e Status. */
export function UserFilters({ values, onChange, onClear, total, profiles }: UserFiltersProps) {
    return (
        <ListFilters
            total={total}
            onClear={onClear}
            search={{ value: values.search, onChange: (search) => onChange({ ...values, search }), placeholder: "Nome ou e-mail..." }}
        >
            <FilterGroup label="Perfis" className="min-w-[180px] flex-1">
                <CadastroMultiSelect
                    options={profiles}
                    selected={values.perfis}
                    onSelect={(perfis) => onChange({ ...values, perfis })}
                    placeholder="Todos"
                    icon={ShieldCheck}
                    searchable
                    searchPlaceholder="Buscar perfil..."
                />
            </FilterGroup>
            <FilterGroup label="Status" className="min-w-[150px] flex-1">
                <CadastroMultiSelect
                    options={STATUS_OPTIONS}
                    selected={values.status}
                    onSelect={(status) => onChange({ ...values, status: status as UserStatus[] })}
                    placeholder="Todos"
                    icon={UserCheck}
                    renderLabel={(option) => <StatusPill active={option.value === "ativo"} />}
                />
            </FilterGroup>
        </ListFilters>
    )
}
