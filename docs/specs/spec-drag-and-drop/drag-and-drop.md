# Spec: Drag and Drop

> **Status:** MVP
> **Prefixo de requisitos:** `DND`
> **Origem:** [PRD §3, §5](../../PRD.md) · [RFC §3, §5.1](../../RFC.md)

## 1. Visão Geral

Mover post-its livremente pela tela arrastando com o mouse/touch, usando
`@dnd-kit/core` e transformações CSS (`translate3d`) para performance a 60fps.
A posição final é persistida.

## 2. Objetivos

- Arrastar e soltar notas livremente (free-position) pelo board.
- Movimentação fluida (60fps) sem repaints caros.
- Nota arrastada vai para frente (`zIndex` de topo).
- Persistir a posição final via auto-save.

## 3. Não-Objetivos

- Travamento em colunas Kanban (mencionado no PRD como possibilidade — **fora do MVP**, registrar como ideia futura).
- Empilhamento ao soltar sobre outra nota ([GRP](../spec-empilhamento/empilhamento.md), feature futura).
- Soltar na lixeira ([LIX](../spec-lixeira-tatil/lixeira-tatil.md), feature futura).

## 4. Requisitos

### Funcionais

- **DND-01** — Cada nota é arrastável (draggable) dentro da área do board.
- **DND-02** — Durante o arraste, a posição visual atualiza em tempo real via `transform: translate3d`.
- **DND-03** — Ao soltar, `position.x/y` da nota é atualizado no store.
- **DND-04** — Ao iniciar o arraste, a nota recebe o maior `zIndex` (`bringToFront`).
- **DND-05** — O arraste não deve disparar entrada em modo de edição (distinguir clique de arraste).
- **DND-06** — A nota não pode ser solta fora dos limites do board (clamp).

### Não-Funcionais

- **DND-NF-01** — 60fps durante o arraste; usar `translate3d` e evitar gravações no `localStorage` durante o movimento ([RFC §5.1](../../RFC.md)).
- **DND-NF-02** — Suporte a acessibilidade nativo do dnd-kit (teclado).
- **DND-NF-03** — Persistência apenas no `onDragEnd` (com debounce do [PER](../spec-persistencia-local/persistencia-local.md)).

## 5. Regras / Edge Cases

- Distinguir um clique simples (selecionar/editar) de um arraste (threshold de movimento).
- Soltar parcialmente fora da viewport → clamp para dentro do board.

## 6. Dependências

- [Fundação & Arquitetura](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — store, `bringToFront`.
- [Persistência](../spec-persistencia-local/persistencia-local.md) — salvar `onDragEnd`.

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| DND-T01 | [Setup do dnd-kit (DndContext + draggable)](tasks/DND-T01-setup-dndkit.md) | DND-01, DND-02, DND-NF-02 |
| DND-T02 | [Atualização de posição no onDragEnd](tasks/DND-T02-update-posicao.md) | DND-03, DND-04, DND-06, DND-NF-03 |
| DND-T03 | [Distinguir clique de arraste + zIndex](tasks/DND-T03-clique-vs-arraste.md) | DND-05, DND-04, DND-NF-01 |
| DND-T04 | [Testes (drag and drop)](tasks/DND-T04-testes.md) | DND-03..06 |

## 8. Critérios de Aceite

- Arrastar uma nota a move suavemente (sem travar) e ela permanece onde foi solta após reload.
- Clicar (sem arrastar) não altera a posição e permite editar.
- A nota arrastada sobrepõe as demais.
