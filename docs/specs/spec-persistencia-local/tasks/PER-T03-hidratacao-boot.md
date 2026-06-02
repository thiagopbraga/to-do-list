# PER-T03 — Hidratação no boot

> **Spec:** [Persistência em localStorage](../persistencia-local.md)
> **Requisitos:** PER-03, PER-04
> **Dependências:** PER-T01

## Objetivo

Restaurar o estado salvo ao iniciar a aplicação, ou iniciar limpo no primeiro
acesso.

## Passos

1. No bootstrap (antes/junto do mount do `App`), chamar `loadState()`.
2. Se houver estado válido → `replaceState` no store.
3. Se `null` → manter estado inicial padrão (board vazio).
4. Validação básica do `version`/shape antes de aplicar (delegar migração à [IMP](../../spec-importacao-dados/importacao-dados.md) quando necessário).

## Critérios de Verificação (DoD)

- [ ] Recarregar a página restaura notas, posições, cores e zIndex.
- [ ] Primeiro acesso (sem dado) abre board vazio sem erro.
- [ ] Estado inválido não trava o boot (fallback limpo).

## Arquivos afetados (estimado)

`src/main.tsx`, `src/store/boardStore.ts`
