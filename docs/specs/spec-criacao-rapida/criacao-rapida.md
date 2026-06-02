# Spec: Criação Rápida de Post-it

> **Status:** MVP
> **Prefixo de requisitos:** `CRI`
> **Origem:** [PRD §3](../../PRD.md)

## 1. Visão Geral

Criar um novo post-it com **duplo clique** em qualquer área vazia do quadro. O
post-it nasce na posição do clique, pronto para edição.

## 2. Objetivos

- Duplo clique em área vazia cria uma nota naquele ponto.
- A nota nova entra em modo de edição imediatamente (handoff para [EDI](../spec-edicao-direta/edicao-direta.md)).

## 3. Não-Objetivos

- Lógica de edição de texto em si ([EDI](../spec-edicao-direta/edicao-direta.md)).
- Movimentação ([DND](../spec-drag-and-drop/drag-and-drop.md)).

## 4. Requisitos

### Funcionais

- **CRI-01** — Duplo clique em área vazia do board cria uma nota com `position` = coordenadas do clique (ajustadas para centralizar a nota no cursor).
- **CRI-02** — A nota criada usa cor padrão (`yellow`) e texto vazio.
- **CRI-03** — A nota recebe o maior `zIndex` (vai para frente).
- **CRI-04** — Após criar, a nota entra automaticamente em modo de edição.
- **CRI-05** — Duplo clique **sobre uma nota existente** não cria nova nota (evento não deve propagar para o board).

### Não-Funcionais

- **CRI-NF-01** — A criação deve refletir imediatamente na UI (otimista) e disparar o auto-save ([PER](../spec-persistencia-local/persistencia-local.md)).

## 5. Regras / Edge Cases

- Clique próximo às bordas: a nota não deve nascer fora da área visível (clamp às bordas do board).
- Coordenadas devem considerar scroll/offset do container do board.

## 6. Dependências

- [Fundação & Arquitetura](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — `addNote`, `bringToFront`.

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| CRI-T01 | [Handler de duplo clique no board](tasks/CRI-T01-handler-duplo-clique.md) | CRI-01, CRI-05, CRI-NF-01 |
| CRI-T02 | [Cálculo de posição e defaults da nota](tasks/CRI-T02-posicao-defaults.md) | CRI-01, CRI-02, CRI-03 |
| CRI-T03 | [Entrar em modo de edição ao criar](tasks/CRI-T03-foco-edicao.md) | CRI-04 |
| CRI-T04 | [Testes (criação rápida)](tasks/CRI-T04-testes.md) | CRI-01..05 |

## 8. Critérios de Aceite

- Duplo clique no vazio cria uma nota amarela vazia sob o cursor, já editável.
- Duplo clique sobre nota existente não gera duplicata.
- Notas próximas à borda não somem para fora da tela.
