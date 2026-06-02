# EDI-T01 — Modo de edição inline

> **Spec:** [Edição Direta](../edicao-direta.md)
> **Requisitos:** EDI-01, EDI-04, EDI-NF-01
> **Dependências:** FND-T04

## Objetivo

Alternar a nota entre modo "exibição" e "edição" via clique, com foco no campo.

## Passos

1. Estado local/UI `editingId` (ou flag por nota).
2. Clique simples no texto → entra em edição; renderiza `<textarea>` (ou `contentEditable` controlado).
3. `autoFocus` ao entrar; sair em blur, `Esc` ou clique fora (EDI-04).
4. Não entrar em edição se o gesto foi um arraste (coordenar com [DND-05](../../spec-drag-and-drop/drag-and-drop.md)).

## Critérios de Verificação (DoD)

- [ ] Clique no texto abre o editor com cursor ativo.
- [ ] Blur/Esc fecham a edição.
- [ ] Arrastar não abre o editor.

## Arquivos afetados (estimado)

`src/components/Note.tsx`
