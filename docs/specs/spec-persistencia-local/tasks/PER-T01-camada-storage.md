# PER-T01 — Camada de storage (serialize/parse)

> **Spec:** [Persistência em localStorage](../persistencia-local.md)
> **Requisitos:** PER-01, PER-NF-02, PER-NF-03
> **Dependências:** FND-T02, FND-T03

## Objetivo

Criar um módulo isolado responsável por ler/gravar o `BoardState` no
`localStorage` com tratamento de erros.

## Passos

1. Criar `src/lib/storage.ts` com chave constante `STORAGE_KEY = "stickyflow:state"`.
2. `saveState(state: BoardState): void` — `JSON.stringify` + `setItem`, capturando `QuotaExceededError`.
3. `loadState(): BoardState | null` — `getItem` + `JSON.parse` com try/catch; retorna `null` em erro.
4. Detectar indisponibilidade do `localStorage` (modo privado) e expor flag/aviso.

## Critérios de Verificação (DoD)

- [ ] `saveState` não lança em quota excedida; emite aviso tratável (PER-NF-02).
- [ ] `loadState` retorna `null` para JSON corrompido sem lançar (PER-NF-03).
- [ ] Chave única e centralizada.

## Arquivos afetados (estimado)

`src/lib/storage.ts`
