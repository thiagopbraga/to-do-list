# LIX-T01 — Zona de lixeira + detecção de colisão

> **Spec:** [Lixeira Tátil](../lixeira-tatil.md) · 🔮 Futuro
> **Requisitos:** LIX-01, LIX-04, LIX-NF-02
> **Dependências:** DND-T01

## Objetivo

Criar a zona de lixeira como droppable e detectar quando uma nota está sobre ela.

## Passos

1. Componente `Trash` usando `useDroppable` (id dedicado).
2. Posicionar em um canto fixo da viewport.
3. Feedback visual quando uma nota está sobre a zona (`isOver`).
4. Integrar ao `DndContext` existente sem afetar o drag normal.

## Critérios de Verificação (DoD)

- [ ] Lixeira visível e reconhecida como droppable.
- [ ] Estado "armado" ao pairar uma nota sobre ela.
- [ ] Movimentação normal de notas não regride.

## Arquivos afetados (estimado)

`src/components/Trash.tsx`, `src/components/Board.tsx`
