# DEC-T01 — Cálculo da idade e faixas de decay

> **Spec:** [Envelhecimento Visual](../envelhecimento-visual.md) · 🔮 Futuro
> **Requisitos:** DEC-01, DEC-02, DEC-04, DEC-NF-02
> **Dependências:** FND-T03

## Objetivo

Derivar um "nível de decay" por nota a partir de `updatedAt`, sem persistir nada.

## Passos

1. Função `getDecayLevel(updatedAt, now)` em `src/lib/decay.ts`.
2. Definir faixas parametrizáveis (constantes) — ex.: fresca / desbotando / antiga.
3. Garantir reset automático: como deriva de `updatedAt`, qualquer update zera (DEC-04).

## Critérios de Verificação (DoD)

- [ ] Função retorna nível coerente para diferentes idades.
- [ ] Faixas centralizadas em constantes.
- [ ] Nenhuma escrita no store/localStorage.

## Arquivos afetados (estimado)

`src/lib/decay.ts`
