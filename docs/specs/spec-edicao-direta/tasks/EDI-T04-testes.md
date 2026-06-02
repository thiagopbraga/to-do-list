# EDI-T04 — Testes (edição direta e anti-XSS)

> **Spec:** [Edição Direta](../edicao-direta.md)
> **Requisitos:** EDI-01, EDI-02, EDI-03, EDI-04, EDI-05
> **Tipo:** Componente
> **Dependências:** EDI-T01..T03, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar o modo de edição inline, o bind ao store e a renderização segura.

## Casos de teste

- Clique no texto entra em modo de edição com foco (EDI-01).
- Digitar atualiza `note.text` no store (EDI-02) e `updatedAt` (EDI-03).
- Blur / `Esc` / clique fora encerram a edição (EDI-04).
- **Anti-XSS:** texto com `<script>` / `<img onerror=...>` é renderizado literal, sem execução; nenhum `dangerouslySetInnerHTML` no componente (EDI-05).
- Quebras de linha preservadas visualmente.

## Critérios de Verificação (DoD)

- [ ] Fluxo de edição coberto.
- [ ] Teste anti-XSS verde.

## Arquivos afetados (estimado)

`src/components/Note.test.tsx`
