# FND-T04 — Layout base do board

> **Spec:** [Fundação & Arquitetura](../fundacao-arquitetura.md)
> **Requisitos:** FND-01, FND-NF-02
> **Dependências:** FND-T03

## Objetivo

Renderizar a tela do quadro (board) que servirá de superfície para os post-its,
consumindo o store.

## Passos

1. Criar `src/components/Board.tsx` — container de tela cheia, posicionamento relativo.
2. Renderizar a lista de `notes` do store (placeholder de post-it por enquanto).
3. Criar `src/components/Toolbar.tsx` — barra com slots para ações futuras
   (exportar, importar, alinhar). Vazia/placeholder neste momento.
4. Montar `App.tsx` com `Board` + `Toolbar`.

## Critérios de Verificação (DoD)

- [ ] Board ocupa a viewport e é a superfície de posicionamento absoluto das notas.
- [ ] Notas do store aparecem como elementos posicionados por `position.x/y`.
- [ ] Sem requisições de rede ao montar.

## Arquivos afetados (estimado)

`src/App.tsx`, `src/components/Board.tsx`, `src/components/Toolbar.tsx`
