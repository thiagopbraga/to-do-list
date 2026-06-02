# LIX-T02 — Animação de amassar + remoção

> **Spec:** [Lixeira Tátil](../lixeira-tatil.md) · 🔮 Futuro
> **Requisitos:** LIX-02, LIX-03, LIX-05, LIX-NF-01
> **Dependências:** LIX-T01, FND-T03

## Objetivo

Animar o "amassar papel" ao soltar na lixeira e remover a nota ao final.

## Passos

1. No `onDragEnd`, se o destino for a lixeira → marcar a nota em estado "amassando".
2. Animação CSS (scale/rotate/opacity) curta.
3. Ao terminar (animationend/timeout), chamar `removeNote(id)`.
4. Remoção persiste via auto-save.

## Critérios de Verificação (DoD)

- [ ] Animação roda suave (transform/opacity) ao soltar na lixeira.
- [ ] Nota some do store após a animação e persiste removida.
- [ ] Cancelar/soltar fora não remove.

## Arquivos afetados (estimado)

`src/components/Note.tsx`, `src/components/Board.tsx`
