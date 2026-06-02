# FND-T05 — Testes (store e schema)

> **Spec:** [Fundação & Arquitetura](../fundacao-arquitetura.md)
> **Requisitos:** FND-02, FND-03, FND-04, FND-05, FND-06
> **Tipo:** Unitário
> **Dependências:** FND-T02, FND-T03, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Garantir que o store e o contrato de dados se comportam conforme a spec.

## Casos de teste

- `addNote` gera `id` único (UUID v4), `createdAt`/`updatedAt` válidos e `zIndex` de topo (FND-04).
- `updateNote` aplica patch e atualiza `updatedAt` sem alterar `createdAt`.
- `removeNote` remove apenas a nota alvo.
- `bringToFront` deixa `zIndex` maior que o de qualquer outra nota.
- `replaceState`/`setNotes` substituem o estado integralmente.
- `board.lastModified` muda a cada mutação (FND-03).
- Estado inicial respeita o schema v1.0 (`version = "1.0"`, `notes = []`) (FND-05).
- `NOTE_COLORS` é consistente com o tipo `NoteColor` (FND-06).

## Critérios de Verificação (DoD)

- [ ] Todos os casos acima cobertos e verdes.
- [ ] IDs e timestamps testados de forma determinística (tempo/uuid mockados).

## Arquivos afetados (estimado)

`src/store/boardStore.test.ts`, `src/types/board.test.ts`
