# GRP-T01 — Regra de colisão e agrupamento por groupId

> **Spec:** [Empilhamento](../empilhamento.md) · 🔮 Futuro
> **Requisitos:** GRP-01, GRP-02, GRP-05, GRP-06, GRP-NF-01
> **Dependências:** DND-T02, FND-T03

## Objetivo

Definir e implementar a regra determinística de "soltar sobre" e a lógica de
atribuição de `groupId`.

## Passos

1. Definir critério de colisão (ex.: centro da nota arrastada dentro do retângulo do alvo, ou overlap ≥ X%).
2. No `onDragEnd`, se houver colisão com outra nota → atribuir `groupId` comum (GRP-02).
3. Arrastar uma nota para fora de um deck → limpar/atualizar `groupId` (GRP-05).
4. Deck com 1 nota restante → `groupId = null` (GRP-06).
5. Ignorar colisão consigo mesma.

## Critérios de Verificação (DoD)

- [ ] Regra de colisão documentada e determinística.
- [ ] Agrupar/desagrupar atualiza `groupId` corretamente.
- [ ] Deck residual de 1 nota se desfaz.

## Arquivos afetados (estimado)

`src/lib/grouping.ts`, `src/components/Board.tsx`
