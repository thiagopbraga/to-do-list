import { useDroppable } from '@dnd-kit/core'

export const TRASH_DROPPABLE_ID = 'trash-dropzone'

export function Trash() {
  const { isOver, setNodeRef } = useDroppable({
    id: TRASH_DROPPABLE_ID,
  })

  return (
    <aside
      ref={setNodeRef}
      className={`pointer-events-auto fixed right-6 bottom-6 z-50 flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-center text-xs font-semibold shadow-lg transition-[transform,opacity,background-color,border-color,box-shadow] ${
        isOver
          ? 'scale-105 border-red-500 bg-red-100 text-red-800 shadow-red-900/20'
          : 'border-stone-500/50 bg-stone-100/90 text-stone-700 opacity-85'
      }`}
      aria-label="Lixeira de notas"
      data-armed={isOver ? 'true' : 'false'}
      data-testid="trash-dropzone"
    >
      <span className="text-sm" aria-hidden="true">
        LIXO
      </span>
      <span>Solte aqui</span>
    </aside>
  )
}
