# EXP-T02 — Download via Blob + File API

> **Spec:** [Exportação de Dados](../exportacao-dados.md)
> **Requisitos:** EXP-03, EXP-04, EXP-05, EXP-06
> **Dependências:** EXP-T01

## Objetivo

Disparar o download nativo do arquivo `.json` no navegador.

## Passos

1. `downloadJson(content, filename)` em `src/lib/file.ts`.
2. Criar `Blob([content], { type: 'application/json' })`.
3. Criar `<a>` invisível com `href = URL.createObjectURL(blob)` e `download = filename`.
4. Forçar `click()` e em seguida `URL.revokeObjectURL` (EXP-06).
5. Gerar nome `stickyflow-backup-YYYY-MM-DD.json` (EXP-05).

## Critérios de Verificação (DoD)

- [ ] Download inicia com o nome datado correto.
- [ ] Object URL é revogada após o clique.
- [ ] Conteúdo do arquivo bate com o estado atual.

## Arquivos afetados (estimado)

`src/lib/file.ts`
