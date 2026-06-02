# FND-T03 — Store global (Zustand)

> **Spec:** [Fundação & Arquitetura](../fundacao-arquitetura.md)
> **Requisitos:** FND-03, FND-04
> **Dependências:** FND-T02

## Objetivo

Criar o store central reativo que gerencia `board` e `notes`, com ações de
mutação puras e geração consistente de metadados.

## Passos

1. Criar `src/store/boardStore.ts` com Zustand.
2. Estado inicial: `version`, `board.theme = 'light'`, `notes = []`.
3. Implementar ações:
   - `addNote(partial)` — gera `id` (UUID v4), `createdAt`/`updatedAt`, `zIndex` = topo.
   - `updateNote(id, patch)` — atualiza campos e `updatedAt`.
   - `removeNote(id)`.
   - `setNotes(notes)` e `replaceState(state)` (para importação).
   - `bringToFront(id)` — recalcula `zIndex` (apoio ao DnD).
4. Atualizar `board.lastModified` a cada mutação.

## Critérios de Verificação (DoD)

- [ ] Cada nota nova recebe `id` único e timestamps válidos.
- [ ] `updateNote` altera `updatedAt` (base para o decay — ver [DEC](../../spec-envelhecimento-visual/envelhecimento-visual.md)).
- [ ] `zIndex` cresce de forma monotônica ao trazer nota para frente.
- [ ] Store mutável fora de componentes (FND-NF-02).

## Arquivos afetados (estimado)

`src/store/boardStore.ts`, `src/lib/uuid.ts`
