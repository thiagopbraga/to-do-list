# MAG-T01 — Cálculo do grid e novas posições

> **Spec:** [Alinhamento Magnético](../alinhamento-magnetico.md) · 🔮 Futuro
> **Requisitos:** MAG-02, MAG-03, MAG-NF-01
> **Dependências:** FND-T03

## Objetivo

Calcular as posições de grade para todas as notas de forma determinística.

## Passos

1. Função `computeGrid(notes, boardSize, noteSize, gutter)` em `src/lib/align.ts`.
2. Determinar nº de colunas a partir da largura do board e tamanho da nota + gutter.
3. Definir ordem dos slots (ex.: por `createdAt`).
4. Retornar mapa `noteId → position` (sem mutar o estado).

## Critérios de Verificação (DoD)

- [ ] Mesma entrada produz o mesmo grid (MAG-NF-01).
- [ ] Posições cabem dentro do board.
- [ ] Espaçamento (gutter) respeitado.

## Arquivos afetados (estimado)

`src/lib/align.ts`
