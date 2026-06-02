# CRI-T01 — Handler de duplo clique no board

> **Spec:** [Criação Rápida](../criacao-rapida.md)
> **Requisitos:** CRI-01, CRI-05, CRI-NF-01
> **Dependências:** FND-T04

## Objetivo

Detectar duplo clique em área vazia do board e disparar a criação de nota.

## Passos

1. Adicionar `onDoubleClick` no container `Board`.
2. Capturar coordenadas relativas ao board (considerar `getBoundingClientRect` e scroll).
3. Garantir que duplo clique originado em uma nota chame `stopPropagation` (CRI-05).
4. Chamar a criação (CRI-T02) com as coordenadas calculadas.

## Critérios de Verificação (DoD)

- [ ] Duplo clique no vazio cria nota; sobre nota existente não cria.
- [ ] Coordenadas corretas mesmo com o board rolado/deslocado.

## Arquivos afetados (estimado)

`src/components/Board.tsx`, `src/components/Note.tsx`
