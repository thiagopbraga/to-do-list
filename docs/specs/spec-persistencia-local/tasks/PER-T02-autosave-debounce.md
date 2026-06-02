# PER-T02 — Auto-save com debounce

> **Spec:** [Persistência em localStorage](../persistencia-local.md)
> **Requisitos:** PER-02, PER-05, PER-NF-01
> **Dependências:** PER-T01

## Objetivo

Persistir automaticamente o estado sempre que ele mudar, com debounce para não
gravar durante o arraste contínuo.

## Passos

1. Criar utilitário `debounce(fn, delay)` em `src/lib/debounce.ts`.
2. Assinar mudanças do store Zustand (`subscribe`).
3. Em cada mudança, atualizar `board.lastModified` e agendar `saveState` com debounce de 500–1000ms.
4. Garantir um flush final (ex.: no `beforeunload`) para não perder a última alteração.

## Critérios de Verificação (DoD)

- [ ] Arrastar uma nota por 3s gera **uma** gravação após parar, não dezenas.
- [ ] `lastModified` é atualizado a cada save (PER-05).
- [ ] Sem perda da última alteração ao fechar a aba.

## Arquivos afetados (estimado)

`src/lib/debounce.ts`, `src/store/persistMiddleware.ts` (ou subscriber)
