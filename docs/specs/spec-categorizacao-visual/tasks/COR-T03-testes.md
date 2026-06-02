# COR-T03 — Testes (categorização visual)

> **Spec:** [Categorização Visual](../categorizacao-visual.md)
> **Requisitos:** COR-02, COR-03, COR-04, COR-05
> **Tipo:** Unitário / Componente
> **Dependências:** COR-T01..T02, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar o mapa de cores, o fallback e a troca de cor na nota.

## Casos de teste

- `getColorClasses` retorna classes para todas as cores da paleta (COR-02/04).
- Cor inválida/desconhecida cai para `yellow` (COR-05).
- Selecionar uma cor chama `updateNote(id, { color })` e reflete no fundo (COR-03).
- Cor ativa destacada no seletor.

## Critérios de Verificação (DoD)

- [ ] Mapa e fallback cobertos em unitário.
- [ ] Interação de troca de cor testada em componente.

## Arquivos afetados (estimado)

`src/lib/colors.test.ts`, `src/components/ColorPicker.test.tsx`
