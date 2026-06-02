import type { Note, Position } from '../types/board'
import { NOTE_CARD_SIZE, clampNotePosition } from './geometry'

type Size = {
  width: number
  height: number
}

export type GridPositions = Record<Note['id'], Position>

export const ALIGN_BOARD_EVENT = 'stickyflow:align-board'
export const DEFAULT_GRID_GUTTER = 24

function getColumnCount(boardWidth: number, noteWidth: number, gutter: number): number {
  const cellWidth = noteWidth + gutter

  if (cellWidth <= 0) {
    return 1
  }

  return Math.max(1, Math.floor((boardWidth + gutter) / cellWidth))
}

export function computeGrid(
  notes: readonly Note[],
  boardSize: Size,
  noteSize: Size = NOTE_CARD_SIZE,
  gutter = DEFAULT_GRID_GUTTER,
): GridPositions {
  if (notes.length === 0) {
    return {}
  }

  const columns = getColumnCount(boardSize.width, noteSize.width, gutter)
  const sortedNotes = [...notes].sort((a, b) => {
    const createdAtOrder = a.createdAt.localeCompare(b.createdAt)

    if (createdAtOrder !== 0) {
      return createdAtOrder
    }

    return a.id.localeCompare(b.id)
  })

  return sortedNotes.reduce<GridPositions>((positions, note, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)

    positions[note.id] = clampNotePosition(
      {
        x: column * (noteSize.width + gutter),
        y: row * (noteSize.height + gutter),
      },
      boardSize,
      noteSize,
    )

    return positions
  }, {})
}
