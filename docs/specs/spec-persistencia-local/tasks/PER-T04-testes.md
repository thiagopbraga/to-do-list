# PER-T04 — Testes (storage, debounce, hidratação)

> **Spec:** [Persistência em localStorage](../persistencia-local.md)
> **Requisitos:** PER-01, PER-02, PER-03, PER-04, PER-NF-02, PER-NF-03
> **Tipo:** Unitário / Componente
> **Dependências:** PER-T01..T03, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar a camada de persistência e o ciclo de auto-save/hidratação.

## Casos de teste

- `saveState`/`loadState` fazem round-trip fiel do `BoardState`.
- `loadState` retorna `null` para JSON corrompido sem lançar (PER-NF-03).
- `saveState` trata `QuotaExceededError` sem quebrar e emite aviso (PER-NF-02).
- Debounce: múltiplas mudanças em sequência geram **uma** gravação após o intervalo (mock de timers) (PER-02).
- Hidratação: com dado salvo válido → store é populado (PER-03); sem dado → board vazio (PER-04).
- `localStorage` indisponível → app continua em memória sem erro.

## Critérios de Verificação (DoD)

- [ ] Round-trip, corrupção e quota cobertos.
- [ ] Debounce testado com `vi.useFakeTimers`.
- [ ] Hidratação com/sem dado coberta.

## Arquivos afetados (estimado)

`src/lib/storage.test.ts`, `src/lib/debounce.test.ts`
