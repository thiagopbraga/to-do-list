import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNoteFactory, resetNoteFactoryCounter } from '../test/factories'
import { installLocalStorageMock } from '../test/localStorageMock'
import { resetBoardStore, useBoardStore } from '../store/boardStore'
import { SCHEMA_VERSION, type BoardState } from '../types/board'
import {
  AUTOSAVE_DELAY_MS,
  STORAGE_KEY,
  initializeBoardPersistence,
  isLocalStorageAvailable,
  loadState,
  parseState,
  saveState,
  serializeState,
  type BoardPersistenceController,
} from './storage'

const FIXED_TIME = new Date('2026-06-02T14:30:00.000Z')

function createBoardState(overrides: Partial<BoardState> = {}): BoardState {
  return {
    version: SCHEMA_VERSION,
    board: {
      lastModified: '2026-06-02T12:00:00.000Z',
      theme: 'light',
    },
    notes: [createNoteFactory({ id: 'persisted-note' })],
    ...overrides,
  }
}

describe('storage', () => {
  let persistence: BoardPersistenceController | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TIME)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    resetNoteFactoryCounter()
    installLocalStorageMock()
    resetBoardStore()
  })

  afterEach(() => {
    persistence?.dispose()
    persistence = null
    resetBoardStore()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('saveState/loadState fazem round-trip fiel do BoardState', () => {
    const state = createBoardState()

    const result = saveState(state)

    expect(result).toEqual({ ok: true })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(serializeState(state))
    expect(loadState()).toEqual(state)
  })

  it('loadState retorna null para JSON corrompido sem lançar', () => {
    localStorage.setItem(STORAGE_KEY, '{')

    expect(() => loadState()).not.toThrow()
    expect(loadState()).toBeNull()
    expect(console.warn).toHaveBeenCalled()
  })

  it('parseState rejeita payload incompatível com schema v1.0', () => {
    const incompatible = JSON.stringify({
      version: '0.9',
      board: { lastModified: '2026-06-02T12:00:00.000Z', theme: 'light' },
      notes: [],
    })

    expect(parseState(incompatible)).toBeNull()
  })

  it('saveState trata QuotaExceededError sem quebrar', () => {
    const quotaError = new DOMException('Sem espaço', 'QuotaExceededError')
    const storage = {
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw quotaError
      }),
    }

    const result = saveState(createBoardState(), storage)

    expect(result).toMatchObject({ ok: false, reason: 'quota-exceeded' })
    expect(console.warn).toHaveBeenCalled()
  })

  it('localStorage indisponível mantém app em memória sem erro', () => {
    const blockedStorage = {
      getItem: vi.fn(() => {
        throw new Error('bloqueado')
      }),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('bloqueado')
      }),
    }

    expect(isLocalStorageAvailable(blockedStorage)).toBe(false)
    expect(loadState(blockedStorage)).toBeNull()
    expect(saveState(createBoardState(), null)).toMatchObject({
      ok: false,
      reason: 'storage-unavailable',
    })
    expect(() => {
      persistence = initializeBoardPersistence({ storage: blockedStorage })
      useBoardStore.getState().setNotes([createNoteFactory({ id: 'memory-only' })])
    }).not.toThrow()
  })

  it('auto-save usa debounce e agrupa mudanças sequenciais em uma gravação', () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem')
    persistence = initializeBoardPersistence({ debounceMs: AUTOSAVE_DELAY_MS })

    useBoardStore.getState().setNotes([createNoteFactory({ id: 'a' })])
    useBoardStore.getState().setNotes([
      createNoteFactory({ id: 'a' }),
      createNoteFactory({ id: 'b' }),
    ])

    expect(setItemSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1)
    expect(setItemSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)

    expect(setItemSpy).toHaveBeenCalledTimes(1)
    expect(loadState()?.notes.map((note) => note.id)).toEqual(['a', 'b'])
  })

  it('flush persiste imediatamente a última alteração pendente', () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem')
    persistence = initializeBoardPersistence({ debounceMs: AUTOSAVE_DELAY_MS })

    useBoardStore.getState().setNotes([createNoteFactory({ id: 'flush-me' })])

    expect(persistence.flush()).toEqual({ ok: true })
    expect(setItemSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(setItemSpy).toHaveBeenCalledTimes(1)
  })

  it('hidrata o store com dado salvo válido no bootstrap', () => {
    const savedState = createBoardState({
      board: {
        lastModified: '2026-06-01T10:00:00.000Z',
        theme: 'dark',
      },
      notes: [createNoteFactory({ id: 'hydrated', text: 'Restaurada' })],
    })
    localStorage.setItem(STORAGE_KEY, serializeState(savedState))

    persistence = initializeBoardPersistence()

    const state = useBoardStore.getState()
    expect(state.board).toEqual(savedState.board)
    expect(state.notes).toEqual(savedState.notes)
  })

  it('sem dado salvo mantém o board inicial vazio', () => {
    persistence = initializeBoardPersistence()

    const state = useBoardStore.getState()
    expect(state.version).toBe(SCHEMA_VERSION)
    expect(state.board.theme).toBe('light')
    expect(state.notes).toEqual([])
  })
})
