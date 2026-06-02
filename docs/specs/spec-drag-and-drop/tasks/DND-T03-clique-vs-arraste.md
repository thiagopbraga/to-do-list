# DND-T03 — Distinguir clique de arraste + zIndex

> **Spec:** [Drag and Drop](../drag-and-drop.md)
> **Requisitos:** DND-05, DND-04, DND-NF-01
> **Dependências:** DND-T01

## Objetivo

Evitar que o arraste dispare edição e garantir que a nota ativa fique no topo.

## Passos

1. Configurar `activationConstraint` (distância mínima, ex.: 4–6px) no PointerSensor para separar clique de arraste.
2. No `onDragStart`, chamar `bringToFront(id)` (DND-04).
3. Garantir que o clique simples (sem ultrapassar o threshold) continue acionando seleção/edição ([EDI](../../spec-edicao-direta/edicao-direta.md)).

## Critérios de Verificação (DoD)

- [ ] Clique curto não move a nota e permite editar.
- [ ] Arraste move sem entrar em edição.
- [ ] Nota arrastada sobrepõe as demais.
- [ ] 60fps mantido (sem jank perceptível).

## Arquivos afetados (estimado)

`src/components/Board.tsx`, `src/components/Note.tsx`
