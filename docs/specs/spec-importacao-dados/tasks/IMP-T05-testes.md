# IMP-T05 — Testes (importação)

> **Spec:** [Importação de Dados](../importacao-dados.md)
> **Requisitos:** IMP-03, IMP-04, IMP-05, IMP-06, IMP-07, IMP-NF-01, IMP-NF-03
> **Tipo:** Unitário / Componente / E2E
> **Dependências:** IMP-T01..T04, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar a validação de schema, o fluxo de confirmação e o tratamento de erros.

## Casos de teste

- `parseImport` aceita JSON válido v1.0 (`ok: true`) (IMP-03).
- JSON malformado / fora do schema / `notes` não-array → `ok: false` (IMP-03/04).
- `version` desconhecida → erro amigável (IMP-07).
- Cor/valor fora de domínio → fallback aplicado (IMP-NF-03).
- **Anti-XSS:** `text` permanece string pura (IMP-NF-01).
- Confirmação: confirmar → `replaceState`; cancelar → estado intacto (IMP-05/06).
- Erro de leitura/validação → toast "Arquivo inválido", app funcional (IMP-04).
- E2E round-trip: exportar → importar → quadro restaurado.

## Critérios de Verificação (DoD)

- [ ] Validação (válido/ inválido/ versão/ fallback) coberta.
- [ ] Fluxo confirmar/cancelar testado.
- [ ] E2E de erro e de round-trip verdes.

## Arquivos afetados (estimado)

`src/lib/schema.test.ts`, `src/components/ImportConfirmModal.test.tsx`, `e2e/backup.spec.ts`
