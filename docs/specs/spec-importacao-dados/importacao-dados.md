# Spec: Importação de Dados (Restaurar)

> **Status:** MVP
> **Prefixo de requisitos:** `IMP`
> **Origem:** [PRD §3, §5](../../PRD.md) · [RFC §4, §5.3, §7](../../RFC.md)

## 1. Visão Geral

Upload de um arquivo `.json` previamente exportado. O sistema lê o arquivo,
**valida o schema**, confirma a sobrescrita com o usuário e restaura o estado
do quadro.

## 2. Objetivos

- Upload de `.json` via `<input type="file">`.
- Leitura com `FileReader` (API nativa).
- Validação estrita de schema (Zod ou validação manual).
- Confirmação explícita antes de sobrescrever o quadro atual.
- Restauração do estado e re-render do board.

## 3. Não-Objetivos

- Mesclagem inteligente de quadros (merge) — MVP faz **sobrescrita**. (Merge fica como ideia futura.)

## 4. Requisitos

### Funcionais

- **IMP-01** — Botão/área "Importar" com `<input type="file" accept="application/json">`.
- **IMP-02** — Ler o arquivo com `FileReader`.
- **IMP-03** — Validar o conteúdo contra o schema v1.0 (campos obrigatórios e tipos).
- **IMP-04** — Se inválido/corrompido → exibir **toast de erro** ("Arquivo inválido") sem quebrar o layout.
- **IMP-05** — Se válido → exibir **modal de confirmação** avisando que os dados atuais serão substituídos.
- **IMP-06** — Após confirmação → `replaceState` no store e persistir; cancelar → nada muda.
- **IMP-07** — Tratar `version` para migração futura (ex.: `1.0` → `2.0`); versão desconhecida → erro amigável.
- **IMP-08** — Sanitização: `text` tratado como texto puro na renderização ([EDI-05](../spec-edicao-direta/edicao-direta.md), [RFC §7](../../RFC.md)).

### Não-Funcionais

- **IMP-NF-01** — Nenhum dado importado pode executar código (defesa XSS — [RFC §7](../../RFC.md)).
- **IMP-NF-02** — Erros de leitura/parse nunca devem travar a aplicação.
- **IMP-NF-03** — Valores fora de domínio (ex.: cor inválida) recebem fallback ([COR-05](../spec-categorizacao-visual/categorizacao-visual.md)).

## 5. Regras / Edge Cases

- Arquivo não-JSON, JSON malformado, ou JSON válido mas fora do schema → todos caem em IMP-04.
- Arquivo gigante / muitas notas → validar antes de aplicar; cuidar do limite do `localStorage` ([PER-NF-02](../spec-persistencia-local/persistencia-local.md)).
- `notes` ausente ou não-array → inválido.

## 6. Dependências

- [Fundação & Arquitetura](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — schema, `replaceState`.
- [Persistência](../spec-persistencia-local/persistencia-local.md) — gravar estado restaurado.

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| IMP-T01 | [Leitura do arquivo (FileReader)](tasks/IMP-T01-leitura-arquivo.md) | IMP-01, IMP-02, IMP-NF-02 |
| IMP-T02 | [Validação de schema + versão](tasks/IMP-T02-validacao-schema.md) | IMP-03, IMP-07, IMP-NF-01, IMP-NF-03 |
| IMP-T03 | [Modal de confirmação de sobrescrita](tasks/IMP-T03-modal-confirmacao.md) | IMP-05, IMP-06 |
| IMP-T04 | [Tratamento de erro (toast)](tasks/IMP-T04-tratamento-erro.md) | IMP-04, IMP-NF-02 |
| IMP-T05 | [Testes (importação)](tasks/IMP-T05-testes.md) | IMP-03..07, IMP-NF-01/03 |

## 8. Critérios de Aceite

- Importar um backup válido → modal de aviso → confirmar → quadro restaurado.
- Importar arquivo inválido/corrompido → toast "Arquivo inválido", quadro intacto.
- Texto com markup malicioso importado é exibido literal, sem executar.
