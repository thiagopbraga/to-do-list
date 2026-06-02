# EXP-T04 — Testes (exportação)

> **Spec:** [Exportação de Dados](../exportacao-dados.md)
> **Requisitos:** EXP-02, EXP-05, EXP-06, EXP-NF-01, EXP-NF-02
> **Tipo:** Unitário / Componente
> **Dependências:** EXP-T01..T03, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar a serialização e o disparo de download do backup.

## Casos de teste

- `serializeBoard` produz JSON fiel ao schema v1.0 com `version` presente (EXP-02).
- Serializar não muta o estado do board (EXP-NF-02).
- Nome do arquivo segue `stickyflow-backup-YYYY-MM-DD.json` (EXP-05).
- `URL.revokeObjectURL` é chamado após o download (EXP-06) — mockar `URL`/`Blob`.
- Board vazio exporta JSON válido com `notes: []`.
- Round-trip lógico: `serialize` → `parseImport` retorna estado equivalente (EXP-NF-01).

## Critérios de Verificação (DoD)

- [ ] Serialização e nome de arquivo cobertos.
- [ ] Revogação de object URL verificada.
- [ ] Round-trip serialize/parse verde.

## Arquivos afetados (estimado)

`src/lib/exportImport.test.ts`, `src/lib/file.test.ts`
