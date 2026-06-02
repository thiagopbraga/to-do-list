# COR-T01 — Mapa de cores → estilos Tailwind

> **Spec:** [Categorização Visual](../categorizacao-visual.md)
> **Requisitos:** COR-02, COR-04, COR-05, COR-NF-01
> **Dependências:** FND-T02

## Objetivo

Centralizar o mapeamento entre `NoteColor` e classes/estilos Tailwind, com
fallback seguro.

## Passos

1. Criar `src/lib/colors.ts` mapeando cada `NoteColor` para classes de fundo/borda/sombra.
2. Função `getColorClasses(color)` com fallback para `yellow` se inválido (COR-05).
3. Garantir consistência com `NOTE_COLORS` da Fundação.

## Critérios de Verificação (DoD)

- [ ] Todas as cores da paleta têm classes definidas.
- [ ] Cor desconhecida retorna estilo de `yellow`.
- [ ] Sem classes Tailwind hardcoded fora deste módulo.

## Arquivos afetados (estimado)

`src/lib/colors.ts`
