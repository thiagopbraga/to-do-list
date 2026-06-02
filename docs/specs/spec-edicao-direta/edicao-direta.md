# Spec: Edição Direta de Texto

> **Status:** MVP
> **Prefixo de requisitos:** `EDI`
> **Origem:** [PRD §3](../../PRD.md) · [RFC §7](../../RFC.md)

## 1. Visão Geral

Editar o conteúdo textual do post-it diretamente sobre ele, em tempo real. O
texto é tratado como **texto puro** (mitigação de XSS).

## 2. Objetivos

- Clicar no texto do post-it para editar inline.
- Atualização em tempo real do `text` e do `updatedAt`.
- Renderização segura (sem `dangerouslySetInnerHTML`).

## 3. Não-Objetivos

- Formatação rica (negrito, listas) — fora do MVP.
- Criação de nota ([CRI](../spec-criacao-rapida/criacao-rapida.md)).

## 4. Requisitos

### Funcionais

- **EDI-01** — Clicar (clique simples) no texto da nota entra em modo de edição.
- **EDI-02** — A digitação atualiza `note.text` em tempo real no store.
- **EDI-03** — Qualquer alteração de texto atualiza `updatedAt` (base do decay — [DEC](../spec-envelhecimento-visual/envelhecimento-visual.md)).
- **EDI-04** — Sair do campo (blur / `Esc` / clique fora) encerra a edição.
- **EDI-05** — O texto deve ser renderizado como texto puro (`textContent`/JSX), **nunca** via `dangerouslySetInnerHTML` ([RFC §7](../../RFC.md)).
- **EDI-06** — Nota com texto vazio ao sair da edição permanece válida (não auto-remove no MVP, salvo decisão futura).

### Não-Funcionais

- **EDI-NF-01** — Edição não conflita com o arraste (ver [DND-05](../spec-drag-and-drop/drag-and-drop.md)).
- **EDI-NF-02** — Atualizações de texto respeitam o debounce de persistência ([PER](../spec-persistencia-local/persistencia-local.md)).

## 5. Regras / Edge Cases

- Multilinha permitida (quebra com `Enter` configurável; ou `Enter` confirma e `Shift+Enter` quebra — decisão de UX).
- Caracteres especiais/HTML no texto não devem ser interpretados como markup.

## 6. Dependências

- [Fundação & Arquitetura](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — `updateNote`.
- Integra com [DND](../spec-drag-and-drop/drag-and-drop.md) (clique vs arraste) e [CRI](../spec-criacao-rapida/criacao-rapida.md) (foco ao criar).

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| EDI-T01 | [Modo de edição inline](tasks/EDI-T01-modo-edicao.md) | EDI-01, EDI-04, EDI-NF-01 |
| EDI-T02 | [Bind do texto ao store](tasks/EDI-T02-bind-texto.md) | EDI-02, EDI-03, EDI-NF-02 |
| EDI-T03 | [Renderização segura (anti-XSS)](tasks/EDI-T03-render-seguro.md) | EDI-05 |
| EDI-T04 | [Testes (edição e anti-XSS)](tasks/EDI-T04-testes.md) | EDI-01..05 |

## 8. Critérios de Aceite

- Clicar no texto permite digitar; o conteúdo persiste após reload.
- Colar `<img onerror=...>` ou `<script>` exibe o texto literal, sem executar.
- Editar e arrastar não se atrapalham.
