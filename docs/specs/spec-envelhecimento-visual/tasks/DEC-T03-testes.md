# DEC-T03 — Testes (decay)

> **Spec:** [Envelhecimento Visual](../envelhecimento-visual.md) · 🔮 Futuro
> **Requisitos:** DEC-01, DEC-02, DEC-04, DEC-NF-02
> **Tipo:** Unitário
> **Dependências:** DEC-T01..T02, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar o cálculo de idade/decay derivado de `updatedAt`.

## Casos de teste

- `getDecayLevel` retorna a faixa correta para diferentes idades (mock de `now`) (DEC-01/02).
- Atualizar `updatedAt` reseta o decay para "fresca" (DEC-04).
- Cálculo é puro — não escreve no store/localStorage (DEC-NF-02).

## Critérios de Verificação (DoD)

- [ ] Faixas testadas em limites (boundaries).
- [ ] Reset por edição coberto.

## Arquivos afetados (estimado)

`src/lib/decay.test.ts`
