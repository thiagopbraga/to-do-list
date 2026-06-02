# EDI-T02 — Bind do texto ao store

> **Spec:** [Edição Direta](../edicao-direta.md)
> **Requisitos:** EDI-02, EDI-03, EDI-NF-02
> **Dependências:** EDI-T01, FND-T03

## Objetivo

Refletir a digitação no store em tempo real, atualizando `text` e `updatedAt`.

## Passos

1. `onChange` do campo chama `updateNote(id, { text })`.
2. Garantir que `updateNote` atualize `updatedAt` (EDI-03).
3. Persistência segue o debounce do [PER](../../spec-persistencia-local/persistencia-local.md) (não gravar a cada tecla).

## Critérios de Verificação (DoD)

- [ ] Texto digitado persiste após reload.
- [ ] `updatedAt` muda ao editar.
- [ ] Sem gravação por tecla (apenas debounce).

## Arquivos afetados (estimado)

`src/components/Note.tsx`, `src/store/boardStore.ts`
