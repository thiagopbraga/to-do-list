# Bug: movimentação de drag and drop pouco fluida

## Sintoma

Durante o arraste de post-its, a movimentação podia parecer travada ou menos
responsiva do que o esperado para uma interação baseada em `translate3d`.

## Causa

A nota arrastável já usava o `transform` retornado pelo `@dnd-kit`, mas o card
não declarava explicitamente que o navegador deveria tratar a interação como
gesto de drag. Também não havia separação visual entre estado em repouso e
estado ativo de arraste.

Isso deixava espaço para duas interferências:

- em dispositivos touch ou trackpads, o navegador podia tentar interpretar o
  gesto como scroll/seleção;
- durante o drag ativo, a classe de transição padrão do card continuava aplicada
  junto da atualização contínua do `transform`.

## Correção aplicada

`NoteCard` agora aplica:

- `touch-none` para evitar que o navegador dispute o gesto com scroll/zoom;
- `select-none` para evitar seleção de texto enquanto o usuário arrasta;
- `transition-none` e `will-change-transform` enquanto `isDragging` está ativo;
- a transição de `left/top/box-shadow/filter` apenas no estado de repouso.

Com isso, o movimento ativo fica dedicado ao `transform: translate3d(...)` do
`@dnd-kit`, reduzindo interferência de CSS e do comportamento nativo do browser.

## Arquivos alterados

- `src/components/NoteCard.tsx`
- `src/components/NoteCard.test.tsx`
- `src/components/Board.test.tsx`

## Validação

A cobertura existente de drag continua verificando que:

- `PointerSensor` mantém threshold de ativação;
- a nota usa `translate3d` durante o movimento;
- o clique curto não move a nota;
- a posição final é persistida apenas no fim do drag.

Os novos ajustes também são cobertos indiretamente pelos testes que mantêm
edição, seleção e drag sem conflito.
