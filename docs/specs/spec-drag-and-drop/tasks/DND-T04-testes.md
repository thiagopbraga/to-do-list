# DND-T04 — Testes (drag and drop)

> **Spec:** [Drag and Drop](../drag-and-drop.md)
> **Requisitos:** DND-03, DND-04, DND-05, DND-06
> **Tipo:** Componente / E2E
> **Dependências:** DND-T01..T03, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar a movimentação de notas e a distinção clique vs arraste.

## Casos de teste

- `onDragEnd` atualiza `position` somando o `delta` corretamente (DND-03).
- Posição final aplica clamp aos limites do board (DND-06).
- Iniciar arraste chama `bringToFront` (DND-04).
- Clique curto (abaixo do threshold) não move e permite editar (DND-05).
- E2E: arrastar e recarregar mantém a nova posição (integra com [PER](../../spec-persistencia-local/persistencia-local.md)).

## Critérios de Verificação (DoD)

- [ ] Lógica de posição/clamp coberta em unitário.
- [ ] Distinção clique/arraste testada.
- [ ] E2E de persistência da posição verde.

## Arquivos afetados (estimado)

`src/lib/geometry.test.ts`, `src/components/Note.test.tsx`, `e2e/board.spec.ts`
