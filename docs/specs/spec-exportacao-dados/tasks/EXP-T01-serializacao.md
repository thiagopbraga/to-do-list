# EXP-T01 — Serialização do estado para JSON

> **Spec:** [Exportação de Dados](../exportacao-dados.md)
> **Requisitos:** EXP-02, EXP-NF-01, EXP-NF-02
> **Dependências:** FND-T02, FND-T03

## Objetivo

Produzir uma string JSON fiel ao schema v1.0 a partir do estado atual do store.

## Passos

1. Criar `serializeBoard(state): string` em `src/lib/exportImport.ts`.
2. Garantir `version = SCHEMA_VERSION` e `board.lastModified` atualizado.
3. Não mutar o estado original (cópia para serialização).

## Critérios de Verificação (DoD)

- [ ] String resultante valida contra o schema v1.0.
- [ ] `version` presente.
- [ ] Estado do board inalterado após serializar.

## Arquivos afetados (estimado)

`src/lib/exportImport.ts`
