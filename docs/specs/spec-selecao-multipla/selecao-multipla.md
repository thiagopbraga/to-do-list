# Spec: Seleção Múltipla

> **Status:** MVP
> **Prefixo de requisitos:** `SEL`
> **Origem:** Solicitação de produto em 2026-06-02

## 1. Visão Geral

Permitir selecionar mais de um to-do/post-it no board sem alterar o conteúdo das
notas nem persistir estado transitório de UI. A seleção múltipla prepara o board
para operações em lote futuras, mantendo os fluxos atuais de edição direta e
drag and drop.

## 2. Objetivos

- Selecionar uma nota com clique simples sem quebrar a entrada em edição.
- Alternar notas adicionais na seleção usando `Ctrl`/`Cmd` + clique.
- Exibir feedback visual claro para cada nota selecionada.
- Manter seleção e drag/edit desacoplados para evitar conflitos de interação.

## 3. Não-Objetivos

- Persistir seleção no `localStorage`.
- Mover múltiplas notas em lote.
- Excluir, exportar ou alterar cor em lote.
- Seleção por retângulo/lasso.

## 4. Requisitos

### Funcionais

- **SEL-01** — Clique simples em uma nota seleciona apenas aquela nota.
- **SEL-02** — Clique simples continua entrando em edição, conforme [EDI-01](../spec-edicao-direta/edicao-direta.md).
- **SEL-03** — `Ctrl`/`Cmd` + clique alterna a nota na seleção sem abrir edição.
- **SEL-04** — O board pode manter duas ou mais notas selecionadas simultaneamente.
- **SEL-05** — Ao iniciar drag em uma nota não selecionada, a seleção passa a conter apenas a nota arrastada.
- **SEL-06** — Ao iniciar drag em uma nota já selecionada, a seleção existente é preservada.
- **SEL-07** — Notas removidas deixam de fazer parte da seleção.

### Não-Funcionais

- **SEL-NF-01** — Seleção é estado local de UI e não altera o schema persistido.
- **SEL-NF-02** — Feedback visual deve ser perceptível sem depender da cor da nota.
- **SEL-NF-03** — Seleção múltipla não deve bloquear digitação, paleta de cores ou drag and drop.

## 5. Regras / Edge Cases

- Clicar em uma nota já selecionada sem modificador reduz a seleção para aquela nota.
- `Ctrl`/`Cmd` + clique em uma nota selecionada remove apenas aquela nota da seleção.
- Criar uma nova nota seleciona a nota criada e inicia edição.
- Seleção vazia é válida quando o usuário alterna a última nota selecionada.

## 6. Dependências

- [Fundação & Arquitetura](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — estado React e renderização do board.
- [Edição Direta](../spec-edicao-direta/edicao-direta.md) — clique simples ainda inicia edição.
- [Drag and Drop](../spec-drag-and-drop/drag-and-drop.md) — drag não deve disparar seleção indevida.

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| SEL-T01 | [Estado local de seleção](tasks/SEL-T01-estado-local.md) | SEL-01, SEL-04, SEL-05, SEL-06, SEL-07, SEL-NF-01 |
| SEL-T02 | [Interação e feedback visual](tasks/SEL-T02-interacao-visual.md) | SEL-02, SEL-03, SEL-NF-02, SEL-NF-03 |
| SEL-T03 | [Testes (seleção múltipla)](tasks/SEL-T03-testes.md) | SEL-01..07, SEL-NF-03 |

## 8. Critérios de Aceite

- Clicar em uma nota seleciona essa nota e entra em edição.
- `Ctrl`/`Cmd` + clique em outra nota mantém a primeira selecionada e seleciona a segunda.
- `Ctrl`/`Cmd` + clique não abre textarea na nota alternada.
- Arrastar e editar continuam funcionando após seleção múltipla.
