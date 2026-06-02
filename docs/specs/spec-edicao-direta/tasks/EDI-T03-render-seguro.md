# EDI-T03 — Renderização segura (anti-XSS)

> **Spec:** [Edição Direta](../edicao-direta.md)
> **Requisitos:** EDI-05
> **Dependências:** EDI-T01
> **Relacionado:** [RFC §7](../../../RFC.md), [IMP](../../spec-importacao-dados/importacao-dados.md)

## Objetivo

Garantir que o texto da nota seja sempre tratado como texto puro, eliminando
risco de XSS (especialmente após importação de arquivos).

## Passos

1. Renderizar o texto exclusivamente via JSX/`textContent` (React já escapa por padrão).
2. Proibir `dangerouslySetInnerHTML` em qualquer parte do componente de nota.
3. Preservar quebras de linha via CSS (`white-space: pre-wrap`), não via HTML.

## Critérios de Verificação (DoD)

- [ ] Texto com `<script>`/`<img onerror>` aparece literal, sem executar.
- [ ] Nenhuma ocorrência de `dangerouslySetInnerHTML` no código de notas.
- [ ] Quebras de linha preservadas visualmente.

## Arquivos afetados (estimado)

`src/components/Note.tsx`
