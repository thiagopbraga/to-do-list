# CRI-T04 — Testes (criação rápida)

> **Spec:** [Criação Rápida](../criacao-rapida.md)
> **Requisitos:** CRI-01, CRI-02, CRI-03, CRI-04, CRI-05
> **Tipo:** Componente
> **Dependências:** CRI-T01..T03, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar a criação de notas por duplo clique e seus defaults.

## Casos de teste

- Duplo clique em área vazia cria uma nota na posição do clique (centralizada) (CRI-01).
- Nota criada tem cor `yellow` e texto vazio (CRI-02).
- Nota criada recebe o maior `zIndex` (CRI-03).
- Nota recém-criada entra em modo de edição com foco (CRI-04).
- Duplo clique sobre nota existente **não** cria duplicata (CRI-05).
- Clique próximo à borda aplica clamp (nota não nasce fora da viewport).

## Critérios de Verificação (DoD)

- [ ] Todos os casos cobertos e verdes.
- [ ] Cálculo de posição/clamp testado.

## Arquivos afetados (estimado)

`src/components/Board.test.tsx`, `src/lib/geometry.test.ts`
