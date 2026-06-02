# Spec: Lixeira Tátil (Amassar Papel)

> **Status:** 🔮 Futuro / Backlog (feature diferenciada — pós-MVP)
> **Prefixo de requisitos:** `LIX`
> **Origem:** [PRD §4](../../PRD.md)

## 1. Visão Geral

Arrastar um post-it até uma área de lixeira dispara uma animação de "papel
amassado" e remove a nota. Reforça a metáfora física do quadro.

## 2. Objetivos

- Zona de lixeira (drop target) visível no board.
- Detecção de colisão entre a nota arrastada e a lixeira (via dnd-kit).
- Animação de amassar antes da remoção definitiva.

## 3. Não-Objetivos

- Lixeira com histórico/recuperação (undo) — pode virar ideia futura separada.

## 4. Requisitos

### Funcionais

- **LIX-01** — Renderizar uma zona de lixeira (`useDroppable`) na UI (ex.: canto da tela).
- **LIX-02** — Ao soltar uma nota sobre a lixeira, disparar animação de "amassar papel".
- **LIX-03** — Ao fim da animação, remover a nota do store (`removeNote`).
- **LIX-04** — Feedback visual da lixeira ao passar uma nota por cima (hover/armed).
- **LIX-05** — A remoção persiste via auto-save ([PER](../spec-persistencia-local/persistencia-local.md)).

### Não-Funcionais

- **LIX-NF-01** — Animação fluida (60fps), preferindo transform/opacity.
- **LIX-NF-02** — Integração com o `onDragEnd` existente do [DnD](../spec-drag-and-drop/drag-and-drop.md) sem regressões na movimentação normal.

## 5. Regras / Edge Cases

- Soltar próximo, mas fora da zona → comportamento normal de mover (não remove).
- Cancelar arraste (Esc) → não remove.

## 6. Dependências

- [Drag and Drop](../spec-drag-and-drop/drag-and-drop.md) — colisão/`onDragEnd`.
- [Fundação](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — `removeNote`.

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| LIX-T01 | [Zona de lixeira + detecção de colisão](tasks/LIX-T01-zona-colisao.md) | LIX-01, LIX-04, LIX-NF-02 |
| LIX-T02 | [Animação de amassar + remoção](tasks/LIX-T02-animacao-remocao.md) | LIX-02, LIX-03, LIX-05, LIX-NF-01 |
| LIX-T03 | [Testes (lixeira tátil)](tasks/LIX-T03-testes.md) | LIX-02/03/05, LIX-NF-02 |

## 8. Critérios de Aceite

- Arrastar uma nota até a lixeira a amassa e remove; persiste após reload.
- Soltar fora da zona apenas move a nota.
