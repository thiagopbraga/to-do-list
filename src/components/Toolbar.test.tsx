import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportBoard } from '../lib/export'
import { readImportFile } from '../lib/import'
import {
  AUTOSAVE_DELAY_MS,
  initializeBoardPersistence,
  loadState,
  type BoardPersistenceController,
} from '../lib/storage'
import { resetBoardStore, useBoardStore } from '../store/boardStore'
import { createNoteFactory } from '../test/factories'
import { installLocalStorageMock } from '../test/localStorageMock'
import { SCHEMA_VERSION, type BoardState } from '../types/board'
import { Toolbar } from './Toolbar'

type ReactActGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

function setReactActEnvironment(value: boolean | undefined): void {
  const testGlobal = globalThis as ReactActGlobal
  testGlobal.IS_REACT_ACT_ENVIRONMENT = value
}

vi.mock('../lib/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/export')>()

  return {
    ...actual,
    exportBoard: vi.fn(),
  }
})

vi.mock('../lib/import', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/import')>()

  return {
    ...actual,
    readImportFile: vi.fn(),
  }
})

const mockedExportBoard = vi.mocked(exportBoard)
const mockedReadImportFile = vi.mocked(readImportFile)

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

describe('Toolbar', () => {
  let root: Root | null = null
  let persistence: BoardPersistenceController | null = null

  beforeEach(() => {
    setReactActEnvironment(true)
    resetBoardStore()
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    persistence?.dispose()
    persistence = null
    root = null
    document.body.innerHTML = ''
    mockedExportBoard.mockReset()
    mockedReadImportFile.mockReset()
    resetBoardStore()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    setReactActEnvironment(undefined)
  })

  async function renderToolbar(): Promise<HTMLDivElement> {
    const container = document.createElement('div')
    document.body.appendChild(container)

    await act(async () => {
      root = createRoot(container)
      root.render(<Toolbar />)
    })

    return container
  }

  function getButton(container: HTMLElement, text: string): HTMLButtonElement {
    const button = [...container.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === text,
    )
    if (!button) throw new Error(`Botão não encontrado: ${text}`)
    return button
  }

  async function selectImportFile(container: HTMLElement, payload: string) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('Input de importação não encontrado')
    const file = new File([payload], 'stickyflow-backup.json', {
      type: 'application/json',
    })

    mockedReadImportFile.mockResolvedValueOnce(payload)

    await act(async () => {
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [file],
      })
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })

    return { file, input }
  }

  it('exibe botão Exportar e aciona exportação do board atual', async () => {
    const note = createNoteFactory({ id: 'note-toolbar' })
    useBoardStore.getState().setNotes([note])
    const container = await renderToolbar()

    const button = getButton(container, 'Exportar')

    await act(async () => {
      button.click()
    })

    expect(mockedExportBoard).toHaveBeenCalledWith(
      expect.objectContaining({
        version: SCHEMA_VERSION,
        notes: [note],
      }),
    )
  })

  it('abre seletor de arquivo ao clicar em Importar', async () => {
    const container = await renderToolbar()
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')

    await act(async () => {
      getButton(container, 'Importar').click()
    })

    expect(input).not.toBeNull()
    expect(input).toHaveAttribute('accept', 'application/json')
    expect(click).toHaveBeenCalled()
  })

  it('mostra erro para import inválido e mantém o board intacto', async () => {
    const currentNote = createNoteFactory({ id: 'current-note' })
    useBoardStore.getState().setNotes([currentNote])
    const container = await renderToolbar()

    const { input } = await selectImportFile(container, '{')

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Arquivo inválido',
    )
    expect(input.value).toBe('')
    expect(useBoardStore.getState().notes).toEqual([currentNote])
  })

  it('abre confirmação para import válido e cancelar não altera o board', async () => {
    const currentNote = createNoteFactory({ id: 'current-note' })
    const importedState = createBoardState({
      notes: [createNoteFactory({ id: 'imported-note' })],
    })
    useBoardStore.getState().setNotes([currentNote])
    const container = await renderToolbar()

    await selectImportFile(container, JSON.stringify(importedState))

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      'Substituir quadro atual?',
    )

    await act(async () => {
      getButton(container, 'Cancelar').click()
    })

    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(useBoardStore.getState().notes).toEqual([currentNote])
  })

  it('confirma import válido, substitui estado e persiste via autosave', async () => {
    vi.useFakeTimers()
    installLocalStorageMock()
    persistence = initializeBoardPersistence({ debounceMs: AUTOSAVE_DELAY_MS })
    useBoardStore.getState().setNotes([createNoteFactory({ id: 'current-note' })])
    const importedState = createBoardState({
      notes: [
        createNoteFactory({
          id: 'restored-note',
          text: '<img src=x onerror=alert(1)>',
        }),
      ],
    })
    const container = await renderToolbar()

    await selectImportFile(container, JSON.stringify(importedState))

    await act(async () => {
      getButton(container, 'Importar e substituir').click()
    })

    expect(useBoardStore.getState().notes).toMatchObject([
      {
        id: 'restored-note',
        text: '<img src=x onerror=alert(1)>',
      },
    ])
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Quadro restaurado',
    )

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    })

    expect(loadState()?.notes.map((note) => note.id)).toEqual(['restored-note'])
  })
})
