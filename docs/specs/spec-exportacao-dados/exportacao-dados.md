# Spec: Exportação de Dados (Backup)

> **Status:** MVP
> **Prefixo de requisitos:** `EXP`
> **Origem:** [PRD §3](../../PRD.md) · [RFC §5.2](../../RFC.md)

## 1. Visão Geral

Botão que gera e baixa instantaneamente um arquivo `.json` com a estrutura
completa do quadro atual (schema v1.0), usando a File API nativa.

## 2. Objetivos

- Exportar o estado completo do board como arquivo `.json` baixável.
- Nome de arquivo com data: `stickyflow-backup-YYYY-MM-DD.json`.
- 100% client-side (sem backend).

## 3. Não-Objetivos

- Exportar formatos alternativos (CSV, PNG) — fora do MVP.
- Restauração (vive em [IMP](../spec-importacao-dados/importacao-dados.md)).

## 4. Requisitos

### Funcionais

- **EXP-01** — Botão "Exportar" na toolbar.
- **EXP-02** — Serializar o estado atual com `JSON.stringify` no schema v1.0 (incluindo `version`).
- **EXP-03** — Gerar `Blob` com MIME `application/json`.
- **EXP-04** — Disparar download via `<a download>` + `URL.createObjectURL`.
- **EXP-05** — Nome do arquivo `stickyflow-backup-YYYY-MM-DD.json`.
- **EXP-06** — Revogar a object URL após o download (`URL.revokeObjectURL`).

### Não-Funcionais

- **EXP-NF-01** — O JSON exportado deve ser reimportável por [IMP](../spec-importacao-dados/importacao-dados.md) sem perda (round-trip).
- **EXP-NF-02** — Exportar não altera o estado atual do board.

## 5. Regras / Edge Cases

- Board vazio → exporta JSON válido com `notes: []`.
- Garantir `lastModified` atualizado no momento da exportação.

## 6. Dependências

- [Fundação & Arquitetura](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — schema/estado.

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| EXP-T01 | [Serialização do estado para JSON](tasks/EXP-T01-serializacao.md) | EXP-02, EXP-NF-01, EXP-NF-02 |
| EXP-T02 | [Download via Blob + File API](tasks/EXP-T02-download-blob.md) | EXP-03, EXP-04, EXP-05, EXP-06 |
| EXP-T03 | [Botão de exportar na toolbar](tasks/EXP-T03-botao-toolbar.md) | EXP-01 |
| EXP-T04 | [Testes (exportação)](tasks/EXP-T04-testes.md) | EXP-02/05/06, EXP-NF-01/02 |

## 8. Critérios de Aceite

- Clicar em "Exportar" baixa um `.json` com nome datado e schema v1.0.
- O arquivo exportado pode ser reimportado restaurando o quadro idêntico.
