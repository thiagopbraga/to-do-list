import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  getCenteredClampedNotePosition,
  getDraggedNotePosition,
} from '../lib/geometry'
import { useBoardStore } from '../store/boardStore'
import type { NoteColor } from '../types/board'
import { NoteCard } from './NoteCard'

const DRAG_ACTIVATION_DISTANCE = 5

export function Board() {
  const boardRef = useRef<HTMLElement | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const notes = useBoardStore((state) => state.notes)
  const addNote = useBoardStore((state) => state.addNote)
  const updateNote = useBoardStore((state) => state.updateNote)
  const bringToFront = useBoardStore((state) => state.bringToFront)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE,
      },
    }),
    useSensor(KeyboardSensor),
  )

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const note = addNote({
        color: 'yellow',
        text: '',
        position: getCenteredClampedNotePosition(event, event.currentTarget),
      })

      setEditingNoteId(note.id)
    },
    [addNote],
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const noteId = String(event.active.id)
      bringToFront(noteId)
    },
    [bringToFront],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const boardElement = boardRef.current
      if (!boardElement) return

      const noteId = String(event.active.id)
      const note = useBoardStore
        .getState()
        .notes.find((candidate) => candidate.id === noteId)
      if (!note) return

      updateNote(noteId, {
        position: getDraggedNotePosition(note.position, event.delta, boardElement),
      })
    },
    [updateNote],
  )

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      updateNote(id, { text })
    },
    [updateNote],
  )

  const handleColorChange = useCallback(
    (id: string, color: NoteColor) => {
      updateNote(id, { color })
    },
    [updateNote],
  )

  const handleEditEnd = useCallback(() => {
    setEditingNoteId(null)
  }, [])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <main
        ref={boardRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-stone-200"
        data-testid="board"
        aria-label="Quadro de post-its"
        onDoubleClick={handleDoubleClick}
      >
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            isEditing={editingNoteId === note.id}
            onEditStart={setEditingNoteId}
            onEditEnd={handleEditEnd}
            onTextChange={handleTextChange}
            onColorChange={handleColorChange}
          />
        ))}
      </main>
    </DndContext>
  )
}
