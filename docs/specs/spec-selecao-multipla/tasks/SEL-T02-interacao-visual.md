# SEL-T02 — Interação e feedback visual

> **Spec:** [Seleção Múltipla](../selecao-multipla.md)
> **Requisitos:** SEL-02, SEL-03, SEL-NF-02, SEL-NF-03
> **Dependências:** SEL-T01, EDI-T01

## Objetivo

Permitir alternância de seleção com modificador e indicar visualmente quais notas
estão selecionadas, preservando edição, cor e drag.

## Passos

1. Adicionar `isSelected` e callback de seleção em `NoteCard`.
2. Clique simples seleciona e inicia edição.
3. `Ctrl`/`Cmd` + clique alterna seleção e não inicia edição.
4. Renderizar marcador visual independente da cor da nota.
5. Expor estado selecionado por atributo testável/acessível.

## Critérios de Verificação (DoD)

- [ ] Nota selecionada tem feedback visual claro.
- [ ] `Ctrl`/`Cmd` + clique não abre textarea.
- [ ] Clique simples mantém o comportamento de edição existente.
- [ ] Paleta de cores e campo de texto não acionam seleção acidental.

## Arquivos afetados (estimado)

`src/components/Board.tsx`, `src/components/NoteCard.tsx`
