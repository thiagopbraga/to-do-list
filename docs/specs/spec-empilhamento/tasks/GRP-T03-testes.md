# GRP-T03 — Testes (empilhamento)

> **Spec:** [Empilhamento](../empilhamento.md) · 🔮 Futuro
> **Requisitos:** GRP-01, GRP-02, GRP-05, GRP-06, GRP-NF-01
> **Tipo:** Unitário / Componente
> **Dependências:** GRP-T01..T02, [TST-T01](../../spec-testes-gerais/tasks/TST-T01-setup-ambiente.md)

## Objetivo

Validar a regra de colisão determinística e a lógica de `groupId`.

## Casos de teste

- Regra de colisão: dentro/abaixo do limiar produz agrupar/mover corretamente (GRP-01/NF-01).
- Soltar A sobre B atribui `groupId` comum (cria deck) (GRP-02).
- Arrastar nota para fora do deck atualiza/limpa `groupId` (GRP-05).
- Deck com 1 nota restante desfaz (`groupId = null`) (GRP-06).
- Soltar sobre si mesma é ignorado.

## Critérios de Verificação (DoD)

- [ ] Colisão testada em boundaries.
- [ ] Agrupar/desagrupar/desfazer cobertos.

## Arquivos afetados (estimado)

`src/lib/grouping.test.ts`, `src/components/Board.test.tsx`
