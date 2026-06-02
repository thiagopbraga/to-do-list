# MAG-T03 — Testes (alinhamento magnético)

> **Spec:** [Alinhamento Magnético](../alinhamento-magnetico.md) · 🔮 Futuro
> **Requisitos:** MAG-02, MAG-03, MAG-05, MAG-NF-01
> **Tipo:** Unitário / Componente
> **Dependências:** MAG-T01..T02, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar o cálculo determinístico da grade e a aplicação das novas posições.

## Casos de teste

- `computeGrid` é determinístico: mesma entrada → mesmo resultado (MAG-NF-01).
- Nº de colunas/linhas coerente com largura do board e tamanho da nota + gutter (MAG-02).
- Todas as posições resultantes cabem dentro do board, com espaçamento correto (MAG-03).
- Board vazio → no-op (sem erro).
- Posições aplicadas persistem (MAG-05).

## Critérios de Verificação (DoD)

- [ ] Determinismo e limites cobertos.
- [ ] No-op para board vazio testado.

## Arquivos afetados (estimado)

`src/lib/align.test.ts`
