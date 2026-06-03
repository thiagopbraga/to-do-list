# SEL-T01 — Estado local de seleção

> **Spec:** [Seleção Múltipla](../selecao-multipla.md)
> **Requisitos:** SEL-01, SEL-04, SEL-05, SEL-06, SEL-07, SEL-NF-01
> **Dependências:** FND-T03, DND-T01

## Objetivo

Adicionar seleção como estado local do board, sem tocar no schema persistido.

## Passos

1. Criar `selectedNoteIds` como `Set<string>` local em `Board`.
2. Clique simples substitui a seleção por uma única nota.
3. Drag em nota não selecionada substitui a seleção pela nota arrastada.
4. Drag em nota já selecionada preserva a seleção atual.
5. Remoção de notas limpa IDs inexistentes da seleção.

## Critérios de Verificação (DoD)

- [ ] Seleção não aparece no payload persistido.
- [ ] Duas ou mais notas podem permanecer selecionadas.
- [ ] Drag em nota fora da seleção seleciona somente aquela nota.
- [ ] Remover uma nota não mantém ID órfão selecionado.

## Arquivos afetados (estimado)

`src/components/Board.tsx`
