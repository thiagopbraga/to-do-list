# LIX-T03 — Testes (lixeira tátil)

> **Spec:** [Lixeira Tátil](../lixeira-tatil.md) · 🔮 Futuro
> **Requisitos:** LIX-02, LIX-03, LIX-05, LIX-NF-02
> **Tipo:** Componente / E2E
> **Dependências:** LIX-T01..T02, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar a remoção via lixeira e a não regressão do drag normal.

## Casos de teste

- Soltar nota sobre a lixeira dispara animação e remove a nota do store (LIX-02/03).
- Remoção persiste após reload (LIX-05).
- Soltar fora da zona apenas move (não remove) — sem regressão do DnD (LIX-NF-02).
- Cancelar arraste (Esc) não remove.

## Critérios de Verificação (DoD)

- [ ] Remoção e persistência cobertas.
- [ ] Não-regressão do movimento normal verificada.

## Arquivos afetados (estimado)

`src/components/Board.test.tsx`, `e2e/trash.spec.ts`
