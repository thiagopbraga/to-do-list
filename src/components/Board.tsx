import { useBoardStore } from '../store/boardStore'
import type { Note, NoteColor } from '../types/board'

const NOTE_COLOR_CLASSES: Record<NoteColor, string> = {
  yellow: 'bg-yellow-200',
  pink: 'bg-pink-200',
  blue: 'bg-blue-200',
  green: 'bg-green-200',
  purple: 'bg-purple-200',
  orange: 'bg-orange-200',
}

function NotePlaceholder({ note }: { note: Note }) {
  return (
    <div
      className={`absolute min-h-24 min-w-32 rounded-sm p-3 shadow-md ${NOTE_COLOR_CLASSES[note.color]}`}
      style={{
        left: note.position.x,
        top: note.position.y,
        zIndex: note.zIndex,
        transform: 'translate3d(0, 0, 0)',
      }}
      data-testid={`note-${note.id}`}
    >
      <p className="text-left text-sm text-stone-800">
        {note.text || 'Nova nota'}
      </p>
    </div>
  )
}

export function Board() {
  const notes = useBoardStore((state) => state.notes)

  return (
    <main
      className="relative min-h-0 flex-1 overflow-hidden bg-stone-200"
      data-testid="board"
      aria-label="Quadro de post-its"
    >
      {notes.map((note) => (
        <NotePlaceholder key={note.id} note={note} />
      ))}
    </main>
  )
}
