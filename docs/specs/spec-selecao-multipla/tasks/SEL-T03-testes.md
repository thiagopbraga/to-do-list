# SEL-T03 — Testes (seleção múltipla)

> **Spec:** [Seleção Múltipla](../selecao-multipla.md)
> **Requisitos:** SEL-01..07, SEL-NF-03
> **Dependências:** SEL-T01, SEL-T02

## Objetivo

Cobrir os fluxos críticos de seleção múltipla e garantir que a feature não
regrediu edição direta nem drag and drop.

## Passos

1. Testar clique simples selecionando e abrindo edição.
2. Testar `Ctrl`/`Cmd` + clique mantendo múltiplas notas selecionadas.
3. Testar que seleção com modificador não abre edição.
4. Testar que eventos do textarea não acionam listeners de drag.
5. Manter testes existentes de drag, edição e persistência verdes.

## Critérios de Verificação (DoD)

- [ ] Testes de componente cobrem seleção simples e múltipla.
- [ ] Testes provam que digitação no textarea não aciona sensor de drag.
- [ ] Suite relevante passa sem regressão.

## Arquivos afetados (estimado)

`src/components/Board.test.tsx`, `src/components/NoteCard.test.tsx`
