# DND-T02 — Atualização de posição no onDragEnd

> **Spec:** [Drag and Drop](../drag-and-drop.md)
> **Requisitos:** DND-03, DND-04, DND-06, DND-NF-03
> **Dependências:** DND-T01, FND-T03

## Objetivo

Persistir a nova posição da nota quando o arraste termina, com clamp aos limites.

## Passos

1. No `onDragEnd` do `DndContext`, calcular `position` final = posição anterior + `delta`.
2. Aplicar clamp às bordas do board (DND-06).
3. Chamar `updateNote(id, { position })`.
4. Não gravar `localStorage` durante o arraste — apenas o auto-save com debounce reage ao update final (DND-NF-03).

## Critérios de Verificação (DoD)

- [ ] Posição final correta e persistida após reload.
- [ ] Nota não fica fora do board.
- [ ] Nenhuma gravação intermediária durante o movimento.

## Arquivos afetados (estimado)

`src/components/Board.tsx`, `src/lib/geometry.ts`
