import { toAppState, useTaskStore, type TaskStore } from '../store/taskStore'
import { isDateKey, isTimeKey } from './dates'
import {
  INBOX_LIST_ID,
  LIST_COLORS,
  PRIORITIES,
  RECURRENCES,
  SCHEMA_VERSION,
  type AppState,
  type Task,
  type TaskList,
} from '../types/task'
import { generateUuid } from './uuid'

export const STORAGE_KEY = 'taskflow:state'
export const LEGACY_STORAGE_KEY = 'stickyflow:state'
export const AUTOSAVE_DELAY_MS = 500

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

export type SaveStateResult =
  | { ok: true }
  | {
      ok: false
      reason: 'quota-exceeded' | 'storage-unavailable' | 'unknown'
      error: unknown
    }

export type PersistenceController = {
  flush: () => SaveStateResult | null
  dispose: () => void
}

type PersistenceOptions = {
  storage?: StorageLike | null
  debounceMs?: number
}

let activePersistence: PersistenceController | null = null

function warnStorageIssue(message: string, error?: unknown): void {
  console.warn(`[TaskFlow] ${message}`, error)
}

function getLocalStorage(): StorageLike | null {
  try {
    return globalThis.localStorage
  } catch (error) {
    warnStorageIssue('localStorage indisponível; persistência desativada.', error)
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.title === 'string' &&
    typeof value.notes === 'string' &&
    isNonEmptyString(value.listId) &&
    typeof value.done === 'boolean' &&
    (value.completedAt === null || isNonEmptyString(value.completedAt)) &&
    (value.dueDate === null || isDateKey(value.dueDate)) &&
    (value.dueTime === null || isTimeKey(value.dueTime)) &&
    RECURRENCES.includes(value.recurrence as Task['recurrence']) &&
    PRIORITIES.includes(value.priority as Task['priority']) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt)
  )
}

function isTaskList(value: unknown): value is TaskList {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.name === 'string' &&
    LIST_COLORS.includes(value.color as TaskList['color']) &&
    isNonEmptyString(value.createdAt)
  )
}

export function isAppState(value: unknown): value is AppState {
  if (
    !isRecord(value) ||
    value.version !== SCHEMA_VERSION ||
    !isRecord(value.settings) ||
    (value.settings.theme !== 'light' && value.settings.theme !== 'dark') ||
    !Array.isArray(value.lists) ||
    !value.lists.every(isTaskList) ||
    !Array.isArray(value.tasks) ||
    !value.tasks.every(isTask)
  ) {
    return false
  }
  const lists = value.lists as TaskList[]
  const listIds = new Set(lists.map((list) => list.id))
  return (
    listIds.has(INBOX_LIST_ID) &&
    (value.tasks as Task[]).every((task) => listIds.has(task.listId))
  )
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state)
}

export function parseState(payload: string): AppState | null {
  try {
    const parsed: unknown = JSON.parse(payload)
    if (!isAppState(parsed)) {
      warnStorageIssue('Estado salvo inválido; iniciando do zero.')
      return null
    }
    return parsed
  } catch (error) {
    warnStorageIssue('Estado salvo corrompido; iniciando do zero.', error)
    return null
  }
}

type LegacyNote = { text?: unknown; createdAt?: unknown; updatedAt?: unknown }

/**
 * Migra o estado do StickyFlow (v1, notas adesivas) para tarefas na Entrada:
 * a primeira linha da nota vira o título e o restante vira anotações.
 */
export function migrateLegacyState(payload: string): Task[] {
  try {
    const parsed: unknown = JSON.parse(payload)
    if (!isRecord(parsed) || !Array.isArray(parsed.notes)) return []
    const timestamp = new Date().toISOString()
    return parsed.notes.flatMap((note: LegacyNote) => {
      if (!isRecord(note) || typeof note.text !== 'string') return []
      const text = note.text.trim()
      if (!text) return []
      const [firstLine, ...rest] = text.split('\n')
      const task: Task = {
        id: generateUuid(),
        title: firstLine.trim(),
        notes: rest.join('\n').trim(),
        listId: INBOX_LIST_ID,
        done: false,
        completedAt: null,
        dueDate: null,
        dueTime: null,
        recurrence: 'none',
        priority: 'none',
        createdAt: isNonEmptyString(note.createdAt) ? note.createdAt : timestamp,
        updatedAt: timestamp,
      }
      return [task]
    })
  } catch {
    return []
  }
}

export function loadState(
  storage: StorageLike | null = getLocalStorage(),
): AppState | null {
  if (!storage) return null
  try {
    const payload = storage.getItem(STORAGE_KEY)
    if (payload) return parseState(payload)

    const legacyPayload = storage.getItem(LEGACY_STORAGE_KEY)
    if (legacyPayload) {
      const tasks = migrateLegacyState(legacyPayload)
      if (tasks.length > 0) {
        const current = toAppState(useTaskStore.getState())
        return { ...current, tasks }
      }
    }
    return null
  } catch (error) {
    warnStorageIssue('Não foi possível ler o estado salvo.', error)
    return null
  }
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

export function saveState(
  state: AppState,
  storage: StorageLike | null = getLocalStorage(),
): SaveStateResult {
  if (!storage) {
    return {
      ok: false,
      reason: 'storage-unavailable',
      error: new Error('localStorage indisponível'),
    }
  }
  try {
    storage.setItem(STORAGE_KEY, serializeState(state))
    return { ok: true }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      warnStorageIssue('Espaço do navegador esgotado; alterações não persistidas.', error)
      return { ok: false, reason: 'quota-exceeded', error }
    }
    warnStorageIssue('Não foi possível persistir o estado.', error)
    return { ok: false, reason: 'unknown', error }
  }
}

export function initializePersistence(
  options: PersistenceOptions = {},
): PersistenceController {
  if (activePersistence) return activePersistence

  const storage = options.storage ?? getLocalStorage()
  const debounceMs = options.debounceMs ?? AUTOSAVE_DELAY_MS
  const savedState = loadState(storage)
  if (savedState) useTaskStore.setState(savedState)

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let pendingState: AppState | null = null

  const clearPendingTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  const flush = (): SaveStateResult | null => {
    if (!pendingState) return null
    clearPendingTimeout()
    const stateToSave = pendingState
    pendingState = null
    return saveState(stateToSave, storage)
  }

  const unsubscribe = useTaskStore.subscribe((state: TaskStore) => {
    pendingState = toAppState(state)
    clearPendingTimeout()
    timeoutId = setTimeout(() => {
      flush()
    }, debounceMs)
  })

  const handleBeforeUnload = () => {
    flush()
  }

  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('beforeunload', handleBeforeUnload)
  }

  const controller: PersistenceController = {
    flush,
    dispose() {
      clearPendingTimeout()
      unsubscribe()
      if (typeof globalThis.removeEventListener === 'function') {
        globalThis.removeEventListener('beforeunload', handleBeforeUnload)
      }
      if (activePersistence === controller) {
        activePersistence = null
      }
    },
  }

  activePersistence = controller
  return controller
}
