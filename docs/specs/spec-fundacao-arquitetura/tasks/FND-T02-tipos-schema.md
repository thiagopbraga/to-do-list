# FND-T02 — Tipos e schema v1.0

> **Spec:** [Fundação & Arquitetura](../fundacao-arquitetura.md)
> **Requisitos:** FND-02, FND-05, FND-06
> **Dependências:** FND-T01

## Objetivo

Definir os contratos de dados em TypeScript que refletem o schema v1.0
descrito na [RFC §4](../../../RFC.md), servindo como fonte única de verdade.

## Passos

1. Criar `src/types/board.ts` com:
   - `NoteColor` (enum/union fechado): `yellow | pink | blue | green | purple | orange`.
   - `Position { x: number; y: number }`.
   - `Note` (id, text, color, position, zIndex, createdAt, updatedAt, groupId).
   - `BoardMeta { lastModified: string; theme: 'light' | 'dark' }`.
   - `BoardState { version: string; board: BoardMeta; notes: Note[] }`.
2. Exportar constante `SCHEMA_VERSION = "1.0"`.
3. Exportar constante `NOTE_COLORS` (lista de cores) reutilizável pela feature de cor.

## Critérios de Verificação (DoD)

- [ ] Tipos compilam sem `any`.
- [ ] `BoardState` é fiel ao JSON da RFC (campos e tipos idênticos).
- [ ] `NoteColor` e `NOTE_COLORS` consistentes entre si.

## Arquivos afetados (estimado)

`src/types/board.ts`
