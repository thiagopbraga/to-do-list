import { useBoardStore, type BoardStore } from '../store/boardStore'
import {
  NOTE_COLORS,
  SCHEMA_VERSION,
  type BoardState,
  type Note,
  type NoteColor,
} from '../types/board'

export const STORAGE_KEY = 'stickyflow:state'
export const AUTOSAVE_DELAY_MS = 750

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

export type SaveStateResult =
  | { ok: true }
  | {
      ok: false
      reason: 'quota-exceeded' | 'storage-unavailable' | 'unknown'
      error: unknown
    }

export type BoardPersistenceController = {
  flush: () => SaveStateResult | null
  dispose: () => void
}

type BoardPersistenceOptions = {
  storage?: StorageLike | null
  debounceMs?: number
}

let activePersistence: BoardPersistenceController | null = null

function warnStorageIssue(message: string, error?: unknown): void {
  console.warn(`[StickyFlow] ${message}`, error)
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

function isNoteColor(value: unknown): value is NoteColor {
  return (
    typeof value === 'string' &&
    NOTE_COLORS.includes(value as NoteColor)
  )
}

function isIsoString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isPosition(value: unknown): value is Note['position'] {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  )
}

function isNote(value: unknown): value is Note {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    isNoteColor(value.color) &&
    isPosition(value.position) &&
    typeof value.zIndex === 'number' &&
    Number.isFinite(value.zIndex) &&
    isIsoString(value.createdAt) &&
    isIsoString(value.updatedAt) &&
    (value.groupId === null || typeof value.groupId === 'string')
  )
}

function isBoardState(value: unknown): value is BoardState {
  return (
    isRecord(value) &&
    value.version === SCHEMA_VERSION &&
    isRecord(value.board) &&
    isIsoString(value.board.lastModified) &&
    (value.board.theme === 'light' || value.board.theme === 'dark') &&
    Array.isArray(value.notes) &&
    value.notes.every(isNote)
  )
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

function toBoardState(state: BoardStore | BoardState): BoardState {
  return {
    version: state.version,
    board: state.board,
    notes: state.notes,
  }
}

function hydrateBoardState(state: BoardState): void {
  useBoardStore.setState({
    version: state.version,
    board: state.board,
    notes: state.notes,
  })
}

export function serializeState(state: BoardState): string {
  return JSON.stringify(state)
}

export function parseState(payload: string): BoardState | null {
  try {
    const parsed: unknown = JSON.parse(payload)
    if (!isBoardState(parsed)) {
      warnStorageIssue('Estado salvo inválido; iniciando com board vazio.')
      return null
    }

    return parsed
  } catch (error) {
    warnStorageIssue('Estado salvo corrompido; iniciando com board vazio.', error)
    return null
  }
}

export function loadState(storage: StorageLike | null = getLocalStorage()): BoardState | null {
  if (!storage) return null

  try {
    const payload = storage.getItem(STORAGE_KEY)
    return payload ? parseState(payload) : null
  } catch (error) {
    warnStorageIssue('Não foi possível ler o estado salvo.', error)
    return null
  }
}

export function saveState(
  state: BoardState,
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
      warnStorageIssue('Espaço do navegador esgotado; alterações não foram persistidas.', error)
      return { ok: false, reason: 'quota-exceeded', error }
    }

    warnStorageIssue('Não foi possível persistir o estado do board.', error)
    return { ok: false, reason: 'unknown', error }
  }
}

export function isLocalStorageAvailable(
  storage: StorageLike | null = getLocalStorage(),
): boolean {
  if (!storage) return false

  try {
    const testKey = `${STORAGE_KEY}:probe`
    storage.setItem(testKey, '1')
    storage.removeItem(testKey)
    return true
  } catch (error) {
    warnStorageIssue('localStorage indisponível; o app continuará em memória.', error)
    return false
  }
}

export function initializeBoardPersistence(
  options: BoardPersistenceOptions = {},
): BoardPersistenceController {
  if (activePersistence) return activePersistence

  const storage = options.storage ?? getLocalStorage()
  const debounceMs = options.debounceMs ?? AUTOSAVE_DELAY_MS
  const savedState = loadState(storage)
  if (savedState) hydrateBoardState(savedState)

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let pendingState: BoardState | null = null

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

  const unsubscribe = useBoardStore.subscribe((state) => {
    pendingState = toBoardState(state)
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

  const controller: BoardPersistenceController = {
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
