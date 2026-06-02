import { NOTE_CARD_SIZE } from './geometry'
import type { Note, Position } from '../types/board'

type Size = {
  width: number
  height: number
}

export type DeckGroup = {
  groupId: string
  notes: Note[]
  coverNote: Note
}

function getNoteCenter(position: Position, noteSize: Size): Position {
  return {
    x: position.x + noteSize.width / 2,
    y: position.y + noteSize.height / 2,
  }
}

function containsPoint(note: Note, point: Position, noteSize: Size): boolean {
  return (
    point.x >= note.position.x &&
    point.x <= note.position.x + noteSize.width &&
    point.y >= note.position.y &&
    point.y <= note.position.y + noteSize.height
  )
}

function compareDeckOrder(a: Note, b: Note): number {
  if (a.zIndex !== b.zIndex) return b.zIndex - a.zIndex
  if (a.updatedAt !== b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt)
  return a.id.localeCompare(b.id)
}

function touchNote(
  note: Note,
  patch: Partial<Pick<Note, 'groupId' | 'position'>>,
  timestamp: string,
): Note {
  return {
    ...note,
    ...patch,
    updatedAt: timestamp,
  }
}

export function getDeckCoverNote(notes: readonly Note[]): Note {
  if (notes.length === 0) {
    throw new Error('Deck vazio não possui nota de capa')
  }

  return [...notes].sort(compareDeckOrder)[0]
}

export function getDeckGroups(notes: readonly Note[]): DeckGroup[] {
  const groups = new Map<string, Note[]>()

  for (const note of notes) {
    if (!note.groupId) continue
    groups.set(note.groupId, [...(groups.get(note.groupId) ?? []), note])
  }

  return [...groups.entries()]
    .filter(([, groupNotes]) => groupNotes.length > 1)
    .map(([groupId, groupNotes]) => ({
      groupId,
      notes: [...groupNotes].sort(compareDeckOrder),
      coverNote: getDeckCoverNote(groupNotes),
    }))
    .sort((a, b) => compareDeckOrder(a.coverNote, b.coverNote))
}

export function findGroupingTarget(
  notes: readonly Note[],
  draggedNoteId: string,
  droppedPosition: Position,
  noteSize: Size = NOTE_CARD_SIZE,
): Note | null {
  const droppedCenter = getNoteCenter(droppedPosition, noteSize)
  const candidates = notes.filter(
    (note) =>
      note.id !== draggedNoteId && containsPoint(note, droppedCenter, noteSize),
  )

  if (candidates.length === 0) return null

  return [...candidates].sort(compareDeckOrder)[0]
}

export function collapseSingletonDecks(
  notes: readonly Note[],
  timestamp: string,
): Note[] {
  const groupSizes = new Map<string, number>()

  for (const note of notes) {
    if (!note.groupId) continue
    groupSizes.set(note.groupId, (groupSizes.get(note.groupId) ?? 0) + 1)
  }

  return notes.map((note) => {
    if (!note.groupId || (groupSizes.get(note.groupId) ?? 0) > 1) {
      return note
    }

    return touchNote(note, { groupId: null }, timestamp)
  })
}

export function moveNoteForDrop(
  notes: readonly Note[],
  noteId: string,
  position: Position,
  timestamp: string,
): Note[] {
  const movedNotes = notes.map((note) => {
    if (note.id !== noteId) return note

    return touchNote(
      note,
      {
        position,
        groupId: null,
      },
      timestamp,
    )
  })

  return collapseSingletonDecks(movedNotes, timestamp)
}

export function groupNoteForDrop(
  notes: readonly Note[],
  draggedNoteId: string,
  targetNoteId: string,
  droppedPosition: Position,
  timestamp: string,
): Note[] {
  if (draggedNoteId === targetNoteId) return [...notes]

  const targetNote = notes.find((note) => note.id === targetNoteId)
  if (!targetNote) return moveNoteForDrop(notes, draggedNoteId, droppedPosition, timestamp)

  const groupId = targetNote.groupId ?? `group:${targetNote.id}`
  const groupedNotes = notes.map((note) => {
    if (note.id === draggedNoteId) {
      return touchNote(note, { position: droppedPosition, groupId }, timestamp)
    }

    if (note.id === targetNoteId && note.groupId !== groupId) {
      return touchNote(note, { groupId }, timestamp)
    }

    return note
  })

  return collapseSingletonDecks(groupedNotes, timestamp)
}

export function removeNoteAndCollapseDecks(
  notes: readonly Note[],
  noteId: string,
  timestamp: string,
): Note[] {
  return collapseSingletonDecks(
    notes.filter((note) => note.id !== noteId),
    timestamp,
  )
}
