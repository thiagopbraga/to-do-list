# IMP-T04 — Tratamento de erro (toast)

> **Spec:** [Importação de Dados](../importacao-dados.md)
> **Requisitos:** IMP-04, IMP-NF-02
> **Dependências:** IMP-T01, IMP-T02

## Objetivo

Exibir feedback amigável para qualquer falha de importação, sem quebrar o layout.

## Passos

1. Criar/usar um sistema de toast simples (`src/components/Toast.tsx` ou lib leve).
2. Em erro de leitura ou validação → toast "Arquivo inválido" (IMP-04).
3. Garantir que nenhum erro de import derrube a aplicação (IMP-NF-02).

## Critérios de Verificação (DoD)

- [ ] Arquivo corrompido/não-JSON → toast de erro; quadro intacto.
- [ ] App permanece funcional após erro de importação.

## Arquivos afetados (estimado)

`src/components/Toast.tsx`, `src/components/Toolbar.tsx`
