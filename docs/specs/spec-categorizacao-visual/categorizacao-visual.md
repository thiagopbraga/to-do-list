# Spec: Categorização Visual (Cor)

> **Status:** MVP
> **Prefixo de requisitos:** `COR`
> **Origem:** [PRD §3](../../PRD.md)

## 1. Visão Geral

Trocar rapidamente a cor de fundo do post-it para categorização visual, a partir
de uma paleta fechada e tipada.

## 2. Objetivos

- Selecionar a cor da nota entre as cores da paleta.
- Persistir a cor escolhida.
- Aplicar estilos (fundo, sombra sutil) via Tailwind.

## 3. Não-Objetivos

- Cores customizadas/livres (hex arbitrário) — fora do MVP (paleta fechada).

## 4. Requisitos

### Funcionais

- **COR-01** — Cada nota expõe um seletor de cor (ex.: paleta ao passar o mouse / menu da nota).
- **COR-02** — As cores disponíveis vêm da paleta fechada `NOTE_COLORS` definida na [Fundação](../spec-fundacao-arquitetura/fundacao-arquitetura.md).
- **COR-03** — Selecionar uma cor atualiza `note.color` no store e `updatedAt`.
- **COR-04** — A cor é refletida visualmente no fundo da nota (e na paleta).
- **COR-05** — Valor inválido de cor (ex.: vindo de import) faz fallback para `yellow`.

### Não-Funcionais

- **COR-NF-01** — Mapeamento cor→classe Tailwind centralizado (sem strings espalhadas).
- **COR-NF-02** — Mudança de cor persiste via auto-save ([PER](../spec-persistencia-local/persistencia-local.md)).

## 5. Regras / Edge Cases

- Importação com cor fora da paleta → fallback (`yellow`) na renderização (coordenar com validação de [IMP](../spec-importacao-dados/importacao-dados.md)).

## 6. Dependências

- [Fundação & Arquitetura](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — `NOTE_COLORS`, `updateNote`.

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| COR-T01 | [Mapa de cores → estilos Tailwind](tasks/COR-T01-mapa-cores.md) | COR-02, COR-04, COR-05, COR-NF-01 |
| COR-T02 | [Seletor de cor na nota](tasks/COR-T02-seletor-cor.md) | COR-01, COR-03, COR-NF-02 |
| COR-T03 | [Testes (categorização visual)](tasks/COR-T03-testes.md) | COR-02..05 |

## 8. Critérios de Aceite

- Trocar a cor reflete imediatamente e persiste após reload.
- Cor inválida importada cai para amarelo sem quebrar a UI.
