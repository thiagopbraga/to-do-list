import { create } from 'zustand'
import { generateUuid } from '../lib/uuid'
import {
  SCHEMA_VERSION,
  type BoardState,
  type Note,
  type NoteInput,
} from '../types/board'

function nowIso(): string {
  return new Date().toISOString()
}

function createInitialState(): BoardState {
  const timestamp = nowIso()
  return {
    version: SCHEMA_VERSION,
    board: {
      lastModified: timestamp,
      theme: 'light',
    },
    notes: [],
  }
}

function getMaxZIndex(notes: Note[]): number {
  if (notes.length === 0) return 0
  return Math.max(...notes.map((note) => note.zIndex))
}

function touchBoard(state: BoardState): BoardState['board'] {
  return {
    ...state.board,
    lastModified: nowIso(),
  }
}

export type BoardStore = BoardState & {
  addNote: (partial?: NoteInput) => Note
  updateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void
  removeNote: (id: string) => void
  setNotes: (notes: Note[]) => void
  replaceState: (state: BoardState) => void
  bringToFront: (id: string) => void
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  ...createInitialState(),

  addNote: (partial = {}) => {
    const timestamp = nowIso()
    const state = get()
    const note: Note = {
      id: generateUuid(),
      text: partial.text ?? '',
      color: partial.color ?? 'yellow',
      position: partial.position ?? { x: 0, y: 0 },
      zIndex: getMaxZIndex(state.notes) + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      groupId: partial.groupId ?? null,
    }

    set({
      notes: [...state.notes, note],
      board: touchBoard(state),
    })

    return note
  },

  updateNote: (id, patch) => {
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === id
          ? { ...note, ...patch, updatedAt: nowIso() }
          : note,
      ),
      board: touchBoard(state),
    }))
  },

  removeNote: (id) => {
    set((state) => ({
      notes: state.notes.filter((note) => note.id !== id),
      board: touchBoard(state),
    }))
  },

  setNotes: (notes) => {
    set((state) => ({
      notes,
      board: touchBoard(state),
    }))
  },

  replaceState: (nextState) => {
    set({
      version: nextState.version,
      board: { ...nextState.board, lastModified: nowIso() },
      notes: nextState.notes,
    })
  },

  bringToFront: (id) => {
    const state = get()
    const maxZ = getMaxZIndex(state.notes)
    const note = state.notes.find((n) => n.id === id)
    if (!note || note.zIndex >= maxZ) return

    set({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, zIndex: maxZ + 1, updatedAt: nowIso() } : n,
      ),
      board: touchBoard(state),
    })
  },
}))

export function resetBoardStore(): void {
  const initial = createInitialState()
  useBoardStore.setState({
    version: initial.version,
    board: initial.board,
    notes: initial.notes,
  })
}
