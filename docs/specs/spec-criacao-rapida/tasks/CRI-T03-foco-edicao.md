# CRI-T03 — Entrar em modo de edição ao criar

> **Spec:** [Criação Rápida](../criacao-rapida.md)
> **Requisitos:** CRI-04
> **Dependências:** CRI-T02, EDI-T01

## Objetivo

Após criar a nota, colocá-la imediatamente em modo de edição com foco no texto.

## Passos

1. Manter um estado de "nota em edição" (id) — local ou no store de UI.
2. Ao criar, marcar a nova nota como em edição.
3. Garantir `autoFocus`/seleção no campo de texto da nota recém-criada.

## Critérios de Verificação (DoD)

- [ ] Logo após o duplo clique, o cursor de texto está ativo na nova nota.
- [ ] Digitar imediatamente preenche o texto sem clique adicional.

## Arquivos afetados (estimado)

`src/components/Note.tsx`, store de UI / prop de edição

## Observação

Depende do contrato de edição definido em [EDI-T01](../../spec-edicao-direta/tasks/EDI-T01-modo-edicao.md).
