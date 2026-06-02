# DND-T01 — Setup do dnd-kit (DndContext + draggable)

> **Spec:** [Drag and Drop](../drag-and-drop.md)
> **Requisitos:** DND-01, DND-02, DND-NF-02
> **Dependências:** FND-T04

## Objetivo

Configurar o `@dnd-kit/core` no board e tornar cada nota arrastável com
feedback visual em tempo real.

## Passos

1. Envolver o `Board` em `<DndContext>`.
2. Usar `useDraggable` em `Note`, aplicando `transform` via `CSS.Translate.toString`.
3. Configurar sensores (Pointer + Keyboard) para acessibilidade.
4. Aplicar `translate3d` para a movimentação (sem alterar `left/top` durante o drag).

## Critérios de Verificação (DoD)

- [ ] Nota acompanha o cursor suavemente ao arrastar.
- [ ] Movimento usa transform (verificável no DevTools).
- [ ] Navegação por teclado move a nota (acessibilidade).

## Arquivos afetados (estimado)

`src/components/Board.tsx`, `src/components/Note.tsx`
