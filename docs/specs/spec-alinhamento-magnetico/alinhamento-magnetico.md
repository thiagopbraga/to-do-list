# Spec: Alinhamento Magnético (Grid)

> **Status:** 🔮 Futuro / Backlog (feature diferenciada — pós-MVP)
> **Prefixo de requisitos:** `MAG`
> **Origem:** [PRD §4](../../PRD.md) · [RFC §Próximos Passos](../../RFC.md)

## 1. Visão Geral

Um botão que organiza automaticamente as notas espalhadas em uma **grade
perfeita**, com animação suave de reposicionamento.

## 2. Objetivos

- Calcular um layout em grade a partir da quantidade de notas e do tamanho do board.
- Reposicionar todas as notas para os slots da grade.
- Animar a transição das posições atuais para as novas.

## 3. Não-Objetivos

- Grid persistente/contínuo (snap a cada movimento) — aqui é uma ação pontual ("organizar agora").
- Layout Kanban por colunas — fora do escopo.

## 4. Requisitos

### Funcionais

- **MAG-01** — Botão "Alinhar" na toolbar.
- **MAG-02** — Calcular dimensões da grade (nº de colunas/linhas) com base na contagem de notas e largura do board ([RFC Próximos Passos §3](../../RFC.md)).
- **MAG-03** — Atribuir a cada nota uma `position` correspondente a um slot da grade (com espaçamento/gutter definido).
- **MAG-04** — Animar a transição das posições antigas para as novas (transform).
- **MAG-05** — As novas posições persistem ([PER](../spec-persistencia-local/persistencia-local.md)).

### Não-Funcionais

- **MAG-NF-01** — Cálculo determinístico e estável (mesma entrada → mesmo grid).
- **MAG-NF-02** — Animação fluida (60fps) mesmo com muitas notas.

## 5. Regras / Edge Cases

- Board vazio → no-op.
- Notas em decks/grupos ([GRP](../spec-empilhamento/empilhamento.md)) → decidir se entram como 1 slot por deck ou são ignoradas (decisão de design ao implementar).
- Ordem dos slots: definir critério (ex.: por `createdAt` ou `zIndex`).

## 6. Dependências

- [Fundação](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — `notes`, `updateNote`/`setNotes`.
- [Persistência](../spec-persistencia-local/persistencia-local.md) — salvar novas posições.

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| MAG-T01 | [Cálculo do grid e novas posições](tasks/MAG-T01-calculo-grid.md) | MAG-02, MAG-03, MAG-NF-01 |
| MAG-T02 | [Botão + animação de reposicionamento](tasks/MAG-T02-botao-animacao.md) | MAG-01, MAG-04, MAG-05, MAG-NF-02 |
| MAG-T03 | [Testes (alinhamento magnético)](tasks/MAG-T03-testes.md) | MAG-02/03/05, MAG-NF-01 |

## 8. Critérios de Aceite

- Clicar em "Alinhar" reorganiza as notas em grade, com animação suave.
- As posições resultantes persistem após reload.
- Board vazio não causa erro.
