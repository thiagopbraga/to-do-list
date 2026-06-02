# EXP-T03 — Botão de exportar na toolbar

> **Spec:** [Exportação de Dados](../exportacao-dados.md)
> **Requisitos:** EXP-01
> **Dependências:** EXP-T01, EXP-T02, FND-T04

## Objetivo

Expor a ação de exportação na UI.

## Passos

1. Adicionar botão "Exportar" na `Toolbar`.
2. Ao clicar: serializar (EXP-T01) e baixar (EXP-T02).
3. Feedback visual mínimo (ex.: toast "Backup gerado").

## Critérios de Verificação (DoD)

- [ ] Botão visível e funcional na toolbar.
- [ ] Clique gera o download.

## Arquivos afetados (estimado)

`src/components/Toolbar.tsx`
