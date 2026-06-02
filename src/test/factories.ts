import type { Note, NoteColor } from '../types/board'

let noteCounter = 0

export function createNoteFactory(overrides: Partial<Note> = {}): Note {
  noteCounter += 1
  const timestamp = '2026-06-02T12:00:00.000Z'

  return {
    id: `note-${noteCounter}`,
    text: 'Nota de teste',
    color: 'yellow',
    position: { x: 10, y: 20 },
    zIndex: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    groupId: null,
    ...overrides,
  }
}

export function resetNoteFactoryCounter(): void {
  noteCounter = 0
}

export function isNoteColor(value: string): value is NoteColor {
  return (
    value === 'yellow' ||
    value === 'pink' ||
    value === 'blue' ||
    value === 'green' ||
    value === 'purple' ||
    value === 'orange'
  )
}
