# IMP-T03 — Modal de confirmação de sobrescrita

> **Spec:** [Importação de Dados](../importacao-dados.md)
> **Requisitos:** IMP-05, IMP-06
> **Dependências:** IMP-T02, FND-T03

## Objetivo

Avisar o usuário que a importação substitui o quadro atual e aplicar o estado
apenas após confirmação.

## Passos

1. Após validação OK, abrir modal: "Isso apagará seu quadro atual. Deseja continuar?".
2. Confirmar → `replaceState(stateImportado)` + persistir ([PER](../../spec-persistencia-local/persistencia-local.md)).
3. Cancelar → fecha o modal e nada muda.
4. Feedback de sucesso (toast "Quadro restaurado").

## Critérios de Verificação (DoD)

- [ ] Modal aparece somente para arquivos válidos.
- [ ] Confirmar substitui o quadro; cancelar mantém intacto.
- [ ] Estado restaurado persiste após reload.

## Arquivos afetados (estimado)

`src/components/ImportConfirmModal.tsx`, `src/store/boardStore.ts`
