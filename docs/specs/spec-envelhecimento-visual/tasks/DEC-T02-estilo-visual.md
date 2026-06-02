# DEC-T02 — Estilo visual gradual

> **Spec:** [Envelhecimento Visual](../envelhecimento-visual.md) · 🔮 Futuro
> **Requisitos:** DEC-03, DEC-NF-01
> **Dependências:** DEC-T01

## Objetivo

Aplicar o efeito visual de desbotamento na nota conforme o nível de decay.

## Passos

1. Mapear nível de decay → classes/estilos (opacidade/saturação) na `Note`.
2. Memoizar o cálculo para não recalcular a cada render desnecessariamente (DEC-NF-01).
3. Definir piso de contraste para legibilidade.

## Critérios de Verificação (DoD)

- [ ] Notas exibem desbotamento proporcional à idade.
- [ ] Sem jank com muitas notas.
- [ ] Texto legível no decay máximo.

## Arquivos afetados (estimado)

`src/components/Note.tsx`, `src/lib/decay.ts`
