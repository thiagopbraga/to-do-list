# CRI-T02 — Cálculo de posição e defaults da nota

> **Spec:** [Criação Rápida](../criacao-rapida.md)
> **Requisitos:** CRI-01, CRI-02, CRI-03
> **Dependências:** CRI-T01, FND-T03

## Objetivo

Criar a nota no store com posição centralizada no cursor e valores padrão.

## Passos

1. Ajustar `position` para centralizar a nota sob o cursor (subtrair metade da largura/altura).
2. Aplicar clamp às bordas do board (não nascer fora da viewport).
3. Definir defaults: `color = 'yellow'`, `text = ''`.
4. Chamar `addNote` (que atribui `id`, timestamps e `zIndex` de topo — CRI-03).

## Critérios de Verificação (DoD)

- [ ] Nota nasce centralizada no ponto do duplo clique.
- [ ] Nota nunca nasce fora da área visível.
- [ ] Cor padrão amarela e texto vazio.

## Arquivos afetados (estimado)

`src/components/Board.tsx`, `src/lib/geometry.ts`
