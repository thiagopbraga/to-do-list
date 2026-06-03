# Bug: espaço bloqueado durante edição de texto

## Sintoma

Ao editar o texto de um post-it, a barra de espaço não se comportava como
digitação normal. O campo de texto recebia foco, mas a tecla podia ser capturada
pelo mecanismo de drag and drop antes de chegar ao fluxo de edição esperado.

## Causa

`NoteCard` espalhava `attributes` e `listeners` do `useDraggable` no elemento
`article` que envolve toda a nota. Como o `textarea` fica dentro desse `article`,
eventos de teclado disparados no campo subiam por bubbling até os listeners do
`@dnd-kit`.

O `KeyboardSensor` usa teclas como espaço/enter para ativar drag acessível por
teclado. Sem isolamento explícito no `textarea`, a edição de texto e o sensor de
drag disputavam o mesmo evento de teclado.

## Correção aplicada

O handler `onKeyDown` do `textarea` agora chama `event.stopPropagation()` antes
de qualquer outra lógica. Assim, teclas digitadas durante edição permanecem no
campo de texto e não chegam aos listeners do card arrastável.

`Escape` continua encerrando a edição, mas também fica isolado do sensor de drag:
primeiro a propagação é interrompida, depois a tecla é tratada localmente pelo
textarea.

## Arquivos alterados

- `src/components/NoteCard.tsx`
- `src/components/NoteCard.test.tsx`

## Validação

Foi adicionado teste de componente garantindo que um `keydown` de espaço no
textarea:

- não chama `preventDefault()`;
- não aciona o listener de teclado vindo do `useDraggable`;
- mantém o comportamento de `Escape` para encerrar edição.
