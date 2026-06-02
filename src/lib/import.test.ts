import { afterEach, describe, expect, it, vi } from 'vitest'
import { serializeBoard } from './export'
import { parseImport, readImportFile } from './import'
import { createNoteFactory, resetNoteFactoryCounter } from '../test/factories'
import { SCHEMA_VERSION, type BoardState } from '../types/board'

const FIXED_TIME = new Date('2026-06-02T14:30:00.000Z')

type FileReaderEventName = 'load' | 'error'
type FileReaderListener = () => void

function createBoardState(overrides: Partial<BoardState> = {}): BoardState {
  return {
    version: SCHEMA_VERSION,
    board: {
      lastModified: '2026-06-02T12:00:00.000Z',
      theme: 'light',
    },
    notes: [createNoteFactory({ id: 'imported-note' })],
    ...overrides,
  }
}

class SuccessfulFileReader {
  result: string | ArrayBuffer | null = null
  error: DOMException | null = null
  private listeners: Partial<Record<FileReaderEventName, FileReaderListener>> = {}

  addEventListener(
    eventName: FileReaderEventName,
    listener: FileReaderListener,
  ): void {
    this.listeners[eventName] = listener
  }

  readAsText(file: File): void {
    void file
    this.result = '{"version":"1.0"}'
    this.listeners.load?.()
  }
}

class FailingFileReader {
  result: string | ArrayBuffer | null = null
  error: DOMException | null = new DOMException('Falha', 'NotReadableError')
  private listeners: Partial<Record<FileReaderEventName, FileReaderListener>> = {}

  addEventListener(
    eventName: FileReaderEventName,
    listener: FileReaderListener,
  ): void {
    this.listeners[eventName] = listener
  }

  readAsText(file: File): void {
    void file
    this.listeners.error?.()
  }
}

describe('importação de dados', () => {
  afterEach(() => {
    resetNoteFactoryCounter()
    vi.unstubAllGlobals()
  })

  it('parseImport aceita JSON válido v1.0 compatível com exportação', () => {
    const state = createBoardState()
    const result = parseImport(serializeBoard(state, FIXED_TIME))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.state).toEqual({
      ...state,
      board: {
        ...state.board,
        lastModified: FIXED_TIME.toISOString(),
      },
    })
  })

  it('parseImport rejeita JSON malformado e schema inválido', () => {
    expect(parseImport('{')).toMatchObject({
      ok: false,
      code: 'invalid-json',
    })
    expect(parseImport(JSON.stringify({ version: SCHEMA_VERSION }))).toMatchObject({
      ok: false,
      code: 'invalid-schema',
    })
    expect(
      parseImport(
        JSON.stringify({
          version: SCHEMA_VERSION,
          board: {
            lastModified: '2026-06-02T12:00:00.000Z',
            theme: 'light',
          },
          notes: {},
        }),
      ),
    ).toMatchObject({
      ok: false,
      code: 'invalid-schema',
    })
  })

  it('parseImport rejeita versão desconhecida com erro amigável', () => {
    const result = parseImport(
      JSON.stringify({
        version: '2.0',
        board: {
          lastModified: '2026-06-02T12:00:00.000Z',
          theme: 'light',
        },
        notes: [],
      }),
    )

    expect(result).toMatchObject({
      ok: false,
      code: 'unsupported-version',
      message: 'Arquivo inválido: versão não suportada',
    })
  })

  it('normaliza cor fora de domínio e preserva texto como string pura', () => {
    const result = parseImport(
      JSON.stringify({
        version: SCHEMA_VERSION,
        board: {
          lastModified: '2026-06-02T12:00:00.000Z',
          theme: 'light',
        },
        notes: [
          {
            id: 'unsafe-note',
            text: '<img src=x onerror=alert(1)>',
            color: 'chartreuse',
            position: { x: 1, y: 2 },
            zIndex: 3,
            createdAt: '2026-06-02T12:00:00.000Z',
            updatedAt: '2026-06-02T12:00:00.000Z',
            groupId: null,
          },
        ],
      }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.state.notes[0]).toMatchObject({
      text: '<img src=x onerror=alert(1)>',
      color: 'yellow',
    })
  })

  it('readImportFile lê arquivo com FileReader.readAsText', async () => {
    vi.stubGlobal('FileReader', SuccessfulFileReader)

    await expect(
      readImportFile(new File(['conteúdo'], 'backup.json')),
    ).resolves.toBe('{"version":"1.0"}')
  })

  it('readImportFile propaga falha de leitura sem quebrar', async () => {
    vi.stubGlobal('FileReader', FailingFileReader)

    await expect(readImportFile(new File([''], 'backup.json'))).rejects.toThrow(
      'Falha',
    )
  })
})
