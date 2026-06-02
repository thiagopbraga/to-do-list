# MAG-T02 — Botão + animação de reposicionamento

> **Spec:** [Alinhamento Magnético](../alinhamento-magnetico.md) · 🔮 Futuro
> **Requisitos:** MAG-01, MAG-04, MAG-05, MAG-NF-02
> **Dependências:** MAG-T01, FND-T04

## Objetivo

Expor a ação "Alinhar" e animar a transição das notas para os slots da grade.

## Passos

1. Botão "Alinhar" na `Toolbar`.
2. Ao clicar: `computeGrid` (MAG-T01) e aplicar as novas `position` via store.
3. Animar a transição (CSS transition em transform) das posições antigas → novas.
4. No-op se não houver notas.
5. Persistência via auto-save.

## Critérios de Verificação (DoD)

- [ ] Botão organiza as notas em grade com animação suave.
- [ ] 60fps com muitas notas.
- [ ] Novas posições persistem; board vazio não quebra.

## Arquivos afetados (estimado)

`src/components/Toolbar.tsx`, `src/components/Board.tsx`, `src/components/Note.tsx`
