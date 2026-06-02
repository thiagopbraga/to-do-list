# IMP-T02 — Validação de schema + versão

> **Spec:** [Importação de Dados](../importacao-dados.md)
> **Requisitos:** IMP-03, IMP-07, IMP-NF-01, IMP-NF-03
> **Dependências:** IMP-T01, FND-T02

## Objetivo

Validar estritamente o JSON importado contra o schema v1.0 antes de aplicá-lo.

## Passos

1. Definir validador (Zod recomendado) para `BoardState` em `src/lib/schema.ts`.
2. `parseImport(text): { ok: true, state } | { ok: false, error }`.
3. Validar `version` (suportar `1.0`; outras → erro amigável até existir migração — IMP-07).
4. Aplicar fallbacks de domínio (cor inválida → `yellow`, IMP-NF-03).
5. Não confiar em nenhum campo: `text` permanece string pura (IMP-NF-01).

## Critérios de Verificação (DoD)

- [ ] JSON fora do schema retorna `ok: false`.
- [ ] `version` desconhecida tratada com mensagem clara.
- [ ] Cores/valores inválidos normalizados sem quebrar.

## Arquivos afetados (estimado)

`src/lib/schema.ts`, `src/lib/exportImport.ts`
