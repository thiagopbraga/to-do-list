import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNoteFactory, resetNoteFactoryCounter } from '../test/factories'
import { SCHEMA_VERSION, type BoardState } from '../types/board'
import {
  createBackupFilename,
  downloadJson,
  serializeBoard,
} from './export'

const FIXED_TIME = new Date('2026-06-02T14:30:00.000Z')
const OBJECT_URL = 'blob:stickyflow-backup'

function createBoardState(overrides: Partial<BoardState> = {}): BoardState {
  return {
    version: SCHEMA_VERSION,
    board: {
      lastModified: '2026-06-01T10:00:00.000Z',
      theme: 'light',
    },
    notes: [createNoteFactory({ id: 'note-export' })],
    ...overrides,
  }
}

describe('exportação de dados', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TIME)
    resetNoteFactoryCounter()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('serializeBoard produz JSON no schema v1.0 com lastModified atualizado', () => {
    const state = createBoardState()

    const parsed = JSON.parse(serializeBoard(state)) as BoardState

    expect(parsed.version).toBe(SCHEMA_VERSION)
    expect(parsed.board).toEqual({
      lastModified: FIXED_TIME.toISOString(),
      theme: 'light',
    })
    expect(parsed.notes).toEqual(state.notes)
  })

  it('serializeBoard não muta o estado original', () => {
    const state = createBoardState()
    const snapshot = structuredClone(state)

    serializeBoard(state)

    expect(state).toEqual(snapshot)
  })

  it('board vazio exporta JSON válido com notes vazio', () => {
    const state = createBoardState({ notes: [] })

    const parsed = JSON.parse(serializeBoard(state)) as BoardState

    expect(parsed.notes).toEqual([])
  })

  it('round-trip lógico preserva o estado exportado', () => {
    const state = createBoardState()
    const serialized = serializeBoard(state)

    const parsed = JSON.parse(serialized) as BoardState

    expect(parsed).toEqual({
      ...state,
      board: {
        ...state.board,
        lastModified: FIXED_TIME.toISOString(),
      },
    })
  })

  it('createBackupFilename usa o padrão stickyflow-backup-YYYY-MM-DD.json', () => {
    expect(createBackupFilename(FIXED_TIME)).toBe(
      'stickyflow-backup-2026-06-02.json',
    )
  })

  it('downloadJson cria Blob, dispara download e revoga object URL', async () => {
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob
      return OBJECT_URL
    })
    const revokeObjectURL = vi.fn()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const content = '{"version":"1.0","notes":[]}'
    const filename = 'stickyflow-backup-2026-06-02.json'

    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })

    downloadJson(content, filename)

    const blob = createObjectURL.mock.calls[0][0]
    const anchor = click.mock.contexts[0] as HTMLAnchorElement

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe(content)
    expect(anchor.download).toBe(filename)
    expect(anchor.href).toBe(OBJECT_URL)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL)
    expect(anchor.isConnected).toBe(false)
  })
})
