# Spec: Empilhamento (Grouping / Deck)

> **Status:** 🔮 Futuro / Backlog (feature diferenciada — pós-MVP)
> **Prefixo de requisitos:** `GRP`
> **Origem:** [PRD §4](../../PRD.md) · [RFC §Próximos Passos](../../RFC.md)

## 1. Visão Geral

Soltar um post-it em cima de outro cria um "deck" (pilha) que representa
agrupamento/subtarefas. Usa o campo `groupId` do schema.

## 2. Objetivos

- Detectar quando uma nota é solta sobre outra (colisão).
- Agrupar notas em um deck via `groupId`.
- Representação visual de pilha e contagem de itens.
- Expandir/recolher o deck.

## 3. Não-Objetivos

- Hierarquia profunda (decks dentro de decks) — manter um nível no MVP da feature.
- Reordenação interna avançada do deck (drag dentro do deck) — pode ser fase 2.

## 4. Requisitos

### Funcionais

- **GRP-01** — Definir regra de colisão para "soltar sobre" (ex.: overlap mínimo / centro dentro do alvo) — ver [RFC Próximos Passos §2](../../RFC.md).
- **GRP-02** — Ao soltar nota A sobre nota B, ambas recebem o mesmo `groupId` (cria deck se B não tiver).
- **GRP-03** — Deck exibe contagem de notas e indicação visual de pilha.
- **GRP-04** — Expandir o deck mostra as notas; recolher volta ao empilhado.
- **GRP-05** — Remover/arrastar uma nota para fora do deck atualiza/limpa seu `groupId`.
- **GRP-06** — Deck com 1 nota restante deixa de ser deck (`groupId = null`).

### Não-Funcionais

- **GRP-NF-01** — Regra de colisão clara e testável (determinística).
- **GRP-NF-02** — Mudanças de agrupamento persistem ([PER](../spec-persistencia-local/persistencia-local.md)).

## 5. Regras / Edge Cases

- Soltar nota sobre si mesma → ignorar.
- Overlap parcial abaixo do limiar → trata como mover, não agrupar.
- Ordem visual da pilha definida por `zIndex`/`updatedAt`.

## 6. Dependências

- [Drag and Drop](../spec-drag-and-drop/drag-and-drop.md) — colisão/`onDragEnd`.
- [Fundação](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — `groupId`, `updateNote`.

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| GRP-T01 | [Regra de colisão e agrupamento por groupId](tasks/GRP-T01-colisao-agrupamento.md) | GRP-01, GRP-02, GRP-05, GRP-06, GRP-NF-01 |
| GRP-T02 | [Visual do deck (pilha, contagem, expandir)](tasks/GRP-T02-visual-deck.md) | GRP-03, GRP-04, GRP-NF-02 |
| GRP-T03 | [Testes (empilhamento)](tasks/GRP-T03-testes.md) | GRP-01/02/05/06, GRP-NF-01 |

## 8. Critérios de Aceite

- Soltar uma nota sobre outra cria um deck com contagem; expandir mostra as notas.
- Tirar uma nota do deck atualiza o agrupamento; deck com 1 nota se desfaz.
- Agrupamentos persistem após reload.
