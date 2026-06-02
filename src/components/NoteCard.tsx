import { useEffect, useRef } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { getNoteColorClasses, NOTE_COLOR_CLASSES } from '../lib/noteColors'
import { NOTE_CARD_SIZE } from '../lib/geometry'
import { NOTE_COLORS, type Note, type NoteColor } from '../types/board'

type NoteCardProps = {
  note: Note
  isEditing: boolean
  onEditStart: (id: string) => void
  onEditEnd: () => void
  onTextChange: (id: string, text: string) => void
  onColorChange: (id: string, color: NoteColor) => void
}

const COLOR_LABELS = {
  yellow: 'amarelo',
  pink: 'rosa',
  blue: 'azul',
  green: 'verde',
  purple: 'roxo',
  orange: 'laranja',
} as const satisfies Record<NoteColor, string>

export function NoteCard({
  note,
  isEditing,
  onEditStart,
  onEditEnd,
  onTextChange,
  onColorChange,
}: NoteCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: note.id,
  })

  useEffect(() => {
    if (!isEditing) return

    const textarea = textareaRef.current
    if (!textarea) return

    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [isEditing])

  const dragTransform = transform
    ? CSS.Translate.toString(transform)
    : 'translate3d(0, 0, 0)'

  return (
    <article
      ref={setNodeRef}
      className={`absolute flex flex-col gap-2 rounded-sm p-3 shadow-md transition-shadow ${isDragging ? 'cursor-grabbing opacity-90' : 'cursor-grab'} ${getNoteColorClasses(note.color)}`}
      style={{
        left: note.position.x,
        top: note.position.y,
        zIndex: note.zIndex,
        width: NOTE_CARD_SIZE.width,
        height: NOTE_CARD_SIZE.height,
        transform: dragTransform,
      }}
      data-testid={`note-${note.id}`}
      aria-label="Post-it"
      onDoubleClick={(event) => event.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      <div
        className="flex items-center gap-1"
        aria-label="Selecionar cor da nota"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {NOTE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`h-5 w-5 rounded-full border border-stone-500/30 ${NOTE_COLOR_CLASSES[color]} ${note.color === color ? 'ring-2 ring-stone-700 ring-offset-1' : ''}`}
            aria-label={`Alterar cor para ${COLOR_LABELS[color]}`}
            aria-pressed={note.color === color}
            data-testid={`note-${note.id}-color-${color}`}
            onClick={() => onColorChange(note.id, color)}
          />
        ))}
      </div>

      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="min-h-0 flex-1 resize-none rounded-sm bg-white/60 p-2 text-left text-sm text-stone-800 outline-none ring-2 ring-stone-700/30"
          aria-label="Editar texto da nota"
          value={note.text}
          onChange={(event) => onTextChange(note.id, event.currentTarget.value)}
          onBlur={onEditEnd}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onEditEnd()
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="min-h-0 flex-1 whitespace-pre-wrap wrap-break-word rounded-sm text-left text-sm text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700"
          aria-label="Editar nota"
          onClick={(event) => {
            event.stopPropagation()
            onEditStart(note.id)
          }}
        >
          {note.text || <span className="text-stone-500">Nova nota</span>}
        </button>
      )}
    </article>
  )
}
