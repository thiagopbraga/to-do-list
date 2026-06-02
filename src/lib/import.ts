import { normalizeNoteColor } from './noteColors'
import {
  SCHEMA_VERSION,
  type BoardState,
  type BoardTheme,
  type Note,
} from '../types/board'

export type ImportErrorCode =
  | 'read-failed'
  | 'invalid-json'
  | 'invalid-schema'
  | 'unsupported-version'

export type ImportParseResult =
  | { ok: true; state: BoardState }
  | { ok: false; code: ImportErrorCode; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoardTheme(value: unknown): value is BoardTheme {
  return value === 'light' || value === 'dark'
}

function invalidSchema(): ImportParseResult {
  return {
    ok: false,
    code: 'invalid-schema',
    message: 'Arquivo inválido',
  }
}

function normalizeNote(value: unknown): Note | null {
  if (!isRecord(value)) return null
  if (!isRecord(value.position)) return null

  if (
    !isNonEmptyString(value.id) ||
    typeof value.text !== 'string' ||
    !isFiniteNumber(value.position.x) ||
    !isFiniteNumber(value.position.y) ||
    !isFiniteNumber(value.zIndex) ||
    !isNonEmptyString(value.createdAt) ||
    !isNonEmptyString(value.updatedAt) ||
    !(value.groupId === null || typeof value.groupId === 'string')
  ) {
    return null
  }

  return {
    id: value.id,
    text: value.text,
    color: normalizeNoteColor(value.color),
    position: {
      x: value.position.x,
      y: value.position.y,
    },
    zIndex: value.zIndex,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    groupId: value.groupId,
  }
}

export function parseImport(payload: string): ImportParseResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(payload)
  } catch {
    return {
      ok: false,
      code: 'invalid-json',
      message: 'Arquivo inválido',
    }
  }

  if (!isRecord(parsed)) return invalidSchema()

  if (parsed.version !== SCHEMA_VERSION) {
    return {
      ok: false,
      code:
        typeof parsed.version === 'string'
          ? 'unsupported-version'
          : 'invalid-schema',
      message:
        typeof parsed.version === 'string'
          ? 'Arquivo inválido: versão não suportada'
          : 'Arquivo inválido',
    }
  }

  if (
    !isRecord(parsed.board) ||
    !isNonEmptyString(parsed.board.lastModified) ||
    !isBoardTheme(parsed.board.theme) ||
    !Array.isArray(parsed.notes)
  ) {
    return invalidSchema()
  }

  const notes: Note[] = []
  for (const notePayload of parsed.notes) {
    const note = normalizeNote(notePayload)
    if (!note) return invalidSchema()
    notes.push(note)
  }

  return {
    ok: true,
    state: {
      version: SCHEMA_VERSION,
      board: {
        lastModified: parsed.board.lastModified,
        theme: parsed.board.theme,
      },
      notes,
    },
  }
}

export function readImportFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Arquivo inválido'))
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Falha ao ler arquivo'))
    })
    reader.readAsText(file)
  })
}
