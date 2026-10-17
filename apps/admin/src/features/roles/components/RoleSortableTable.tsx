"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
    DndContext,
    DragOverlay,
    MouseSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
    type Modifier,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { RoleCells, RoleSortableRow } from "./RoleTableRow"
import type { IRole } from "../types"

/**
 * A LINHA ARRASTADA NÃO SAI DO `<tbody>` (copiado do Smart Desk): limitar o transform ao corpo da
 * tabela impede que a linha estique a área rolável da div `overflow-x-auto`. Eixo X zerado.
 */
export const restringirAoCorpoDaTabela: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
    if (!draggingNodeRect || !containerNodeRect) return transform
    const acima = containerNodeRect.top - draggingNodeRect.top
    const abaixo = containerNodeRect.bottom - draggingNodeRect.bottom
    return { ...transform, x: 0, y: Math.min(Math.max(transform.y, acima), abaixo) }
}

/** Fora do componente: identidade estável. */
const MODIFICADORES = [restringirAoCorpoDaTabela]

const TH = "p-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"

interface RoleSortableTableProps {
    roles: IRole[]
    mostrarOrdem: boolean
    podeReordenar: (role: IRole) => boolean
    /** Nova ordem completa da lista exibida, depois de soltar. */
    onReorder: (ids: string[]) => void
    onEdit: (role: IRole) => void
    onDelete: (role: IRole) => void
}

/**
 * A ORDEM DA LISTA É A HIERARQUIA (como no Discord), e arrastar é a única forma de defini-la.
 * Quem segue o ponteiro é a cópia no `DragOverlay` (portal `position: fixed`), com as larguras
 * lidas do `<thead>` no início do gesto.
 */
export function RoleSortableTable({ roles, mostrarOrdem, podeReordenar, onReorder, onEdit, onDelete }: RoleSortableTableProps) {
    const [cargoArrastado, setCargoArrastado] = useState<IRole | null>(null)
    const [larguras, setLarguras] = useState<number[]>([])
    const tabelaRef = useRef<HTMLTableElement>(null)

    const sensors = useSensors(
        // `distance: 6` evita que um clique vire um arraste de 1px.
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    )

    /**
     * A div da tabela não rola sozinha durante o arraste: o `overflow-x-auto` a torna candidata a
     * auto-scroll do dnd-kit; `canScroll=false` faz o dnd-kit pular para o ancestral que rola a página.
     */
    const wrapperRolagemRef = useRef<HTMLDivElement>(null)
    const autoScroll = useMemo(() => ({ canScroll: (element: Element) => element !== wrapperRolagemRef.current }), [])

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            const id = String(event.active.id)
            setCargoArrastado(roles.find((r) => r._id === id) ?? null)
            const cabecalho = tabelaRef.current?.tHead?.rows[0]
            if (cabecalho) setLarguras(Array.from(cabecalho.cells).map((celula) => celula.getBoundingClientRect().width))
        },
        [roles],
    )

    const handleDragEnd = (event: DragEndEvent) => {
        setCargoArrastado(null)
        const { active, over } = event
        if (!over || active.id === over.id) return

        const cargoAtivo = roles.find((role) => role._id === String(active.id))
        const cargoDestino = roles.find((role) => role._id === String(over.id))
        if (!cargoAtivo || !cargoDestino || !podeReordenar(cargoAtivo) || !podeReordenar(cargoDestino)) return

        const atual = roles.map((r) => r._id)
        const de = atual.indexOf(String(active.id))
        const para = atual.indexOf(String(over.id))
        if (de === -1 || para === -1) return
        onReorder(arrayMove(atual, de, para))
    }

    return (
        <div ref={wrapperRolagemRef} className="overflow-x-auto">
            <table ref={tabelaRef} className="w-full">
                <thead>
                    <tr className="border-b">
                        {mostrarOrdem && <th className="w-[1%] p-3" aria-label="Ordem" />}
                        <th className={`w-[1%] ${TH} text-center`}>Status</th>
                        <th className={TH}>Perfil</th>
                        <th className={TH}>Permissões</th>
                        <th className={TH}>Membros</th>
                        <th className={`w-[1%] ${TH} text-center`}>Ações</th>
                    </tr>
                </thead>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setCargoArrastado(null)}
                    autoScroll={autoScroll}
                    modifiers={MODIFICADORES}
                >
                    <SortableContext items={roles.map((r) => r._id)} strategy={verticalListSortingStrategy}>
                        <tbody>
                            {roles.map((role) => (
                                <RoleSortableRow
                                    key={role._id}
                                    role={role}
                                    mostrarOrdem={mostrarOrdem}
                                    arrastavel={podeReordenar(role)}
                                    onEdit={() => onEdit(role)}
                                    onDelete={() => onDelete(role)}
                                />
                            ))}
                        </tbody>
                    </SortableContext>

                    {/* `<table>` em volta porque `<tr>` fora de tabela não renderiza; `pointer-events-none`
                        evita abrir o tooltip da contagem no meio do arraste. */}
                    <DragOverlay>
                        {cargoArrastado && (
                            <table
                                className="pointer-events-none border-collapse bg-background shadow-lg"
                                style={{ tableLayout: "fixed", width: larguras.reduce((soma, l) => soma + l, 0) || undefined }}
                            >
                                <tbody>
                                    <tr className="border-b">
                                        <RoleCells
                                            role={cargoArrastado}
                                            mostrarOrdem={mostrarOrdem}
                                            arrastavel={podeReordenar(cargoArrastado)}
                                            larguras={larguras}
                                            arrastando
                                        />
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </DragOverlay>
                </DndContext>
            </table>
        </div>
    )
}
