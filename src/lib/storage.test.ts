import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetTaskStore, useTaskStore } from '../store/taskStore'
import { createAppStateFactory, createTaskFactory } from '../test/factories'
import { createLocalStorageMock } from '../test/localStorageMock'
import { INBOX_LIST_ID } from '../types/task'
import {
  AUTOSAVE_DELAY_MS,
  initializePersistence,
  LEGACY_STORAGE_KEY,
  loadState,
  migrateLegacyState,
  parseState,
  saveState,
  serializeState,
  STORAGE_KEY,
  type PersistenceController,
} from './storage'

beforeEach(() => {
  resetTaskStore()
})

describe('parseState', () => {
  it('aceita estado válido', () => {
    const state = createAppStateFactory({ tasks: [createTaskFactory()] })
    expect(parseState(serializeState(state))).toEqual(state)
  })

  it('rejeita JSON inválido e schema desconhecido', () => {
    expect(parseState('{nope')).toBeNull()
    expect(parseState('{"version":"9.9"}')).toBeNull()
  })

  it('rejeita tarefa apontando para lista inexistente', () => {
    const state = createAppStateFactory({
      tasks: [createTaskFactory({ listId: 'nao-existe' })],
    })
    expect(parseState(serializeState(state))).toBeNull()
  })

  it('rejeita estado sem a lista Entrada', () => {
    const state = createAppStateFactory({ lists: [] })
    expect(parseState(serializeState(state))).toBeNull()
  })

  it('rejeita datas e horas malformadas', () => {
    const badDate = createAppStateFactory({
      tasks: [createTaskFactory({ dueDate: '09/07/2026' })],
    })
    const badTime = createAppStateFactory({
      tasks: [createTaskFactory({ dueDate: '2026-07-09', dueTime: '25:00' })],
    })
    expect(parseState(serializeState(badDate))).toBeNull()
    expect(parseState(serializeState(badTime))).toBeNull()
  })
})

describe('saveState / loadState', () => {
  it('faz roundtrip por um storage', () => {
    const storage = createLocalStorageMock()
    const state = createAppStateFactory({ tasks: [createTaskFactory()] })
    expect(saveState(state, storage)).toEqual({ ok: true })
    expect(loadState(storage)).toEqual(state)
  })

  it('retorna erro quando storage está indisponível', () => {
    const result = saveState(createAppStateFactory(), null)
    expect(result.ok).toBe(false)
  })

  it('migra estado legado do StickyFlow para tarefas na Entrada', () => {
    const storage = createLocalStorageMock()
    storage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        version: '1.0',
        board: { lastModified: 'x', theme: 'light' },
        notes: [
          { text: 'Comprar pão\nintegral, 2 unidades' },
          { text: '   ' },
        ],
      }),
    )

    const state = loadState(storage)
    expect(state).not.toBeNull()
    expect(state?.tasks).toHaveLength(1)
    expect(state?.tasks[0].title).toBe('Comprar pão')
    expect(state?.tasks[0].notes).toBe('integral, 2 unidades')
    expect(state?.tasks[0].listId).toBe(INBOX_LIST_ID)
  })

  it('prefere o estado novo ao legado', () => {
    const storage = createLocalStorageMock()
    const state = createAppStateFactory({
      tasks: [createTaskFactory({ title: 'Nova era' })],
    })
    storage.setItem(STORAGE_KEY, serializeState(state))
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ notes: [{ text: 'velha' }] }))
    expect(loadState(storage)?.tasks[0].title).toBe('Nova era')
  })
})

describe('migrateLegacyState', () => {
  it('retorna vazio para payload inválido', () => {
    expect(migrateLegacyState('{oops')).toEqual([])
    expect(migrateLegacyState('{"notes":"nada"}')).toEqual([])
  })
})

describe('initializePersistence', () => {
  let controller: PersistenceController | null = null

  afterEach(() => {
    controller?.dispose()
    controller = null
    vi.useRealTimers()
  })

  it('hidrata o store a partir do storage e salva com debounce', () => {
    vi.useFakeTimers()
    const storage = createLocalStorageMock()
    const saved = createAppStateFactory({
      tasks: [createTaskFactory({ title: 'Persistida' })],
    })
    storage.setItem(STORAGE_KEY, serializeState(saved))

    controller = initializePersistence({ storage })
    expect(useTaskStore.getState().tasks[0]?.title).toBe('Persistida')

    useTaskStore.getState().addTask({ title: 'Nova' })
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 10)

    const persisted = parseState(storage.getItem(STORAGE_KEY) ?? '')
    expect(persisted?.tasks.map((t) => t.title)).toContain('Nova')
  })

  it('flush força a gravação pendente', () => {
    vi.useFakeTimers()
    const storage = createLocalStorageMock()
    controller = initializePersistence({ storage })

    useTaskStore.getState().addTask({ title: 'Imediata' })
    expect(controller.flush()).toEqual({ ok: true })
    const persisted = parseState(storage.getItem(STORAGE_KEY) ?? '')
    expect(persisted?.tasks[0]?.title).toBe('Imediata')
  })
})
