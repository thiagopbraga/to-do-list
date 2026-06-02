# COR-T02 — Seletor de cor na nota

> **Spec:** [Categorização Visual](../categorizacao-visual.md)
> **Requisitos:** COR-01, COR-03, COR-NF-02
> **Dependências:** COR-T01, FND-T03

## Objetivo

Adicionar à nota um controle para trocar a cor entre as opções da paleta.

## Passos

1. Renderizar uma paleta de cores (swatches) na nota — visível em hover ou via botão de menu.
2. Ao clicar em uma cor, chamar `updateNote(id, { color })`.
3. Aplicar `getColorClasses` ao fundo da nota e destacar a cor ativa.
4. Persistência via auto-save (debounce).

## Critérios de Verificação (DoD)

- [ ] Seletor mostra as cores da paleta.
- [ ] Clicar troca a cor da nota imediatamente e persiste.
- [ ] Cor ativa fica destacada no seletor.

## Arquivos afetados (estimado)

`src/components/Note.tsx`, `src/components/ColorPicker.tsx`
