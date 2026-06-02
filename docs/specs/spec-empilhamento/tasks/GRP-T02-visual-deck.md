# GRP-T02 — Visual do deck (pilha, contagem, expandir)

> **Spec:** [Empilhamento](../empilhamento.md) · 🔮 Futuro
> **Requisitos:** GRP-03, GRP-04, GRP-NF-02
> **Dependências:** GRP-T01

## Objetivo

Representar visualmente o agrupamento como uma pilha interativa.

## Passos

1. Renderizar notas com mesmo `groupId` como pilha (offset/rotação leve), mostrando contagem.
2. Ação de expandir → distribuir/mostrar as notas do deck; recolher → reempilhar.
3. Garantir persistência do agrupamento ([PER](../../spec-persistencia-local/persistencia-local.md)).

## Critérios de Verificação (DoD)

- [ ] Deck mostra contagem e aparência de pilha.
- [ ] Expandir/recolher funciona.
- [ ] Estado do deck persiste após reload.

## Arquivos afetados (estimado)

`src/components/Deck.tsx`, `src/components/Board.tsx`
