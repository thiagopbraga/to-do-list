import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION } from '../types/board'
import { createNoteFactory, resetNoteFactoryCounter } from '../test/factories'
import { resetBoardStore, useBoardStore } from './boardStore'

const FIXED_TIME = new Date('2026-06-02T14:30:00.000Z')
const FIXED_UUID = '00000000-0000-4000-8000-000000000001'
const FIXED_UUID_2 = '00000000-0000-4000-8000-000000000002'

vi.mock('../lib/uuid', () => ({
  generateUuid: vi.fn(),
}))

import { generateUuid } from '../lib/uuid'

const mockedGenerateUuid = vi.mocked(generateUuid)

describe('boardStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TIME)
    resetNoteFactoryCounter()
    resetBoardStore()
    mockedGenerateUuid.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('estado inicial respeita schema v1.0', () => {
    const state = useBoardStore.getState()
    expect(state.version).toBe(SCHEMA_VERSION)
    expect(state.board.theme).toBe('light')
    expect(state.notes).toEqual([])
    expect(state.board.lastModified).toBe(FIXED_TIME.toISOString())
  })

  it('addNote gera id único, timestamps e zIndex de topo', () => {
    mockedGenerateUuid.mockReturnValueOnce(FIXED_UUID)

    const note = useBoardStore.getState().addNote({ text: 'Comprar café' })

    expect(note.id).toBe(FIXED_UUID)
    expect(note.text).toBe('Comprar café')
    expect(note.createdAt).toBe(FIXED_TIME.toISOString())
    expect(note.updatedAt).toBe(FIXED_TIME.toISOString())
    expect(note.zIndex).toBe(1)

    const state = useBoardStore.getState()
    expect(state.notes).toHaveLength(1)
    expect(state.board.lastModified).toBe(FIXED_TIME.toISOString())
  })

  it('addNote incrementa zIndex monotonicamente', () => {
    mockedGenerateUuid
      .mockReturnValueOnce(FIXED_UUID)
      .mockReturnValueOnce(FIXED_UUID_2)

    const first = useBoardStore.getState().addNote()
    const second = useBoardStore.getState().addNote()

    expect(first.zIndex).toBe(1)
    expect(second.zIndex).toBe(2)
  })

  it('updateNote aplica patch e atualiza updatedAt sem alterar createdAt', () => {
    mockedGenerateUuid.mockReturnValueOnce(FIXED_UUID)
    const created = useBoardStore.getState().addNote({ text: 'Antes' })
    const createdAt = created.createdAt

    vi.setSystemTime(new Date('2026-06-02T15:00:00.000Z'))
    useBoardStore.getState().updateNote(FIXED_UUID, { text: 'Depois' })

    const updated = useBoardStore.getState().notes[0]
    expect(updated.text).toBe('Depois')
    expect(updated.createdAt).toBe(createdAt)
    expect(updated.updatedAt).toBe('2026-06-02T15:00:00.000Z')
    expect(useBoardStore.getState().board.lastModified).toBe(
      '2026-06-02T15:00:00.000Z',
    )
  })

  it('removeNote remove apenas a nota alvo', () => {
    mockedGenerateUuid
      .mockReturnValueOnce(FIXED_UUID)
      .mockReturnValueOnce(FIXED_UUID_2)

    useBoardStore.getState().addNote({ text: 'A' })
    useBoardStore.getState().addNote({ text: 'B' })
    useBoardStore.getState().removeNote(FIXED_UUID)

    const notes = useBoardStore.getState().notes
    expect(notes).toHaveLength(1)
    expect(notes[0].id).toBe(FIXED_UUID_2)
  })

  it('bringToFront deixa zIndex maior que qualquer outra nota', () => {
    mockedGenerateUuid
      .mockReturnValueOnce(FIXED_UUID)
      .mockReturnValueOnce(FIXED_UUID_2)

    useBoardStore.getState().addNote()
    useBoardStore.getState().addNote()
    useBoardStore.getState().bringToFront(FIXED_UUID)

    const notes = useBoardStore.getState().notes
    const front = notes.find((n) => n.id === FIXED_UUID)
    const other = notes.find((n) => n.id === FIXED_UUID_2)

    expect(front?.zIndex).toBeGreaterThan(other?.zIndex ?? 0)
  })

  it('setNotes substitui a lista integralmente', () => {
    const replacement = [
      createNoteFactory({ id: 'a', zIndex: 5 }),
      createNoteFactory({ id: 'b', zIndex: 10 }),
    ]

    useBoardStore.getState().setNotes(replacement)

    expect(useBoardStore.getState().notes).toEqual(replacement)
    expect(useBoardStore.getState().board.lastModified).toBe(
      FIXED_TIME.toISOString(),
    )
  })

  it('replaceState substitui o estado integralmente', () => {
    const nextState = {
      version: SCHEMA_VERSION,
      board: {
        lastModified: '2026-06-01T10:00:00.000Z',
        theme: 'dark' as const,
      },
      notes: [createNoteFactory({ id: 'imported' })],
    }

    useBoardStore.getState().replaceState(nextState)

    const state = useBoardStore.getState()
    expect(state.board.theme).toBe('dark')
    expect(state.notes).toHaveLength(1)
    expect(state.notes[0].id).toBe('imported')
    expect(state.board.lastModified).toBe(FIXED_TIME.toISOString())
  })

  it('board.lastModified muda a cada mutação', () => {
    mockedGenerateUuid.mockReturnValueOnce(FIXED_UUID)

    const initial = useBoardStore.getState().board.lastModified
    useBoardStore.getState().addNote()

    vi.setSystemTime(new Date('2026-06-02T16:00:00.000Z'))
    useBoardStore.getState().updateNote(FIXED_UUID, { text: 'x' })

    expect(useBoardStore.getState().board.lastModified).not.toBe(initial)
    expect(useBoardStore.getState().board.lastModified).toBe(
      '2026-06-02T16:00:00.000Z',
    )
  })
})
