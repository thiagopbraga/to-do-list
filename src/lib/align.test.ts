import { describe, expect, it } from 'vitest'
import { createNoteFactory } from '../test/factories'
import type { Note } from '../types/board'
import { DEFAULT_GRID_GUTTER, computeGrid } from './align'
import { NOTE_CARD_SIZE } from './geometry'

function createNotes(): Note[] {
  return [
    createNoteFactory({
      id: 'note-b',
      position: { x: 400, y: 400 },
      createdAt: '2026-06-02T12:02:00.000Z',
    }),
    createNoteFactory({
      id: 'note-a',
      position: { x: 200, y: 200 },
      createdAt: '2026-06-02T12:01:00.000Z',
    }),
    createNoteFactory({
      id: 'note-c',
      position: { x: 600, y: 600 },
      createdAt: '2026-06-02T12:03:00.000Z',
    }),
  ]
}

describe('alinhamento magnético', () => {
  it('calcula o mesmo grid determinístico sem depender da ordem de entrada', () => {
    const notes = createNotes()
    const boardSize = { width: 400, height: 400 }

    expect(computeGrid(notes, boardSize)).toEqual(
      computeGrid([...notes].reverse(), boardSize),
    )
    expect(notes.map((note) => note.position)).toEqual([
      { x: 400, y: 400 },
      { x: 200, y: 200 },
      { x: 600, y: 600 },
    ])
  })

  it('mantém as posições calculadas dentro dos limites do board', () => {
    const notes = createNotes()

    expect(computeGrid(notes, { width: 344, height: 180 })).toEqual({
      'note-a': { x: 0, y: 0 },
      'note-b': { x: 184, y: 0 },
      'note-c': { x: 0, y: 52 },
    })
  })

  it('retorna no-op para board vazio', () => {
    expect(computeGrid([], { width: 400, height: 400 })).toEqual({})
  })

  it('usa dimensões da nota e gutter para definir os slots', () => {
    const notes = createNotes()
    const customNoteSize = { width: 100, height: 50 }
    const gutter = 10

    expect(
      computeGrid(notes, { width: 210, height: 200 }, customNoteSize, gutter),
    ).toEqual({
      'note-a': { x: 0, y: 0 },
      'note-b': { x: customNoteSize.width + gutter, y: 0 },
      'note-c': { x: 0, y: customNoteSize.height + gutter },
    })
  })

  it('usa NOTE_CARD_SIZE e o gutter padrão por default', () => {
    const notes = createNotes()

    expect(computeGrid(notes, { width: 344, height: 400 })).toEqual({
      'note-a': { x: 0, y: 0 },
      'note-b': { x: NOTE_CARD_SIZE.width + DEFAULT_GRID_GUTTER, y: 0 },
      'note-c': { x: 0, y: NOTE_CARD_SIZE.height + DEFAULT_GRID_GUTTER },
    })
  })
})
