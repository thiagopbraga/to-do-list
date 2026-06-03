import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALIGN_BOARD_EVENT } from '../lib/align'
import {
  AUTOSAVE_DELAY_MS,
  initializeBoardPersistence,
  STORAGE_KEY,
  type BoardPersistenceController,
} from '../lib/storage'
import { resetBoardStore, useBoardStore } from '../store/boardStore'
import { createNoteFactory, resetNoteFactoryCounter } from '../test/factories'
import { installLocalStorageMock } from '../test/localStorageMock'
import type { NoteColor } from '../types/board'
import { Board } from './Board'
import { TRASH_DROPPABLE_ID } from './Trash'

type CapturedDndContextProps = {
  onDragStart?: (event: { active: { id: string } }) => void
  onDragEnd?: (event: {
    active: { id: string }
    delta: { x: number; y: number }
    over?: { id: string } | null
  }) => void
}

const dndKitMock = vi.hoisted(() => ({
  contextProps: {} as CapturedDndContextProps,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  setNodeRef: vi.fn(),
  setDroppableNodeRef: vi.fn(),
  useSensor: vi.fn((sensor: unknown, options?: unknown) => ({ sensor, options })),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
  useDraggable: vi.fn(),
  useDroppable: vi.fn(),
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    ...props
  }: {
    children: ReactNode
  } & CapturedDndContextProps) => {
    dndKitMock.contextProps = props
    return children
  },
  KeyboardSensor: dndKitMock.KeyboardSensor,
  PointerSensor: dndKitMock.PointerSensor,
  useSensor: dndKitMock.useSensor,
  useSensors: dndKitMock.useSensors,
  useDraggable: dndKitMock.useDraggable,
  useDroppable: dndKitMock.useDroppable,
}))

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true

function setBoardMetrics(
  element: HTMLElement,
  {
    width = 800,
    height = 600,
    left = 0,
    top = 0,
  }: {
    width?: number
    height?: number
    left?: number
    top?: number
  } = {},
): void {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
  })

  element.getBoundingClientRect = vi.fn(() => ({
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  }))
}

describe('Board', () => {
  let container: HTMLDivElement
  let root: Root
  let persistence: BoardPersistenceController | null = null

  beforeEach(() => {
    resetNoteFactoryCounter()
    resetBoardStore()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    dndKitMock.contextProps = {}
    dndKitMock.setNodeRef.mockReset()
    dndKitMock.setDroppableNodeRef.mockReset()
    dndKitMock.useSensor.mockClear()
    dndKitMock.useSensors.mockClear()
    dndKitMock.useDraggable.mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: dndKitMock.setNodeRef,
      transform: null,
      isDragging: false,
    })
    dndKitMock.useDroppable.mockReturnValue({
      isOver: false,
      setNodeRef: dndKitMock.setDroppableNodeRef,
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    persistence?.dispose()
    persistence = null
    container.remove()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  function renderBoard(): void {
    act(() => {
      root.render(<Board />)
    })
  }

  function queryElement<T extends Element>(selector: string): T {
    const element = container.querySelector<T>(selector)
    if (!element) throw new Error(`Elemento não encontrado: ${selector}`)
    return element
  }

  function doubleClick(
    element: Element,
    { clientX = 0, clientY = 0 }: { clientX?: number; clientY?: number } = {},
  ): void {
    element.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, clientX, clientY }),
    )
  }

  function inputText(textarea: HTMLTextAreaElement, value: string): void {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set

    valueSetter?.call(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }

  it('renderiza fallback amarelo quando a nota tem cor desconhecida', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({
        id: 'invalid-color',
        color: 'chartreuse' as NoteColor,
      }),
    ])

    renderBoard()

    expect(queryElement('[data-testid="note-invalid-color"]')).toHaveClass(
      'bg-yellow-200',
    )
  })

  it('configura sensores de ponteiro com threshold e teclado', () => {
    renderBoard()

    expect(dndKitMock.useSensor).toHaveBeenCalledWith(
      dndKitMock.PointerSensor,
      {
        activationConstraint: {
          distance: 5,
        },
      },
    )
    expect(dndKitMock.useSensor).toHaveBeenCalledWith(dndKitMock.KeyboardSensor)
  })

  it('cria nota no duplo clique do board com defaults, clamp e foco em edição', () => {
    renderBoard()
    const board = queryElement<HTMLElement>('[data-testid="board"]')
    setBoardMetrics(board, { width: 300, height: 250 })

    act(() => {
      doubleClick(board, { clientX: 290, clientY: 240 })
    })

    const notes = useBoardStore.getState().notes
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      text: '',
      color: 'yellow',
      position: { x: 140, y: 122 },
      zIndex: 1,
    })
    expect(
      queryElement('[aria-label="Editar texto da nota"]'),
    ).toHaveFocus()
    expect(queryElement('[data-testid^="note-"]')).toHaveAttribute(
      'data-selected',
      'true',
    )
  })

  it('não cria outra nota ao dar duplo clique sobre nota existente', () => {
    useBoardStore.getState().setNotes([createNoteFactory({ id: 'existing' })])
    renderBoard()

    act(() => {
      doubleClick(queryElement('[data-testid="note-existing"]'))
    })

    expect(useBoardStore.getState().notes).toHaveLength(1)
  })

  it('edita texto inline no store e renderiza HTML como texto literal', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({ id: 'editable', text: 'Antes' }),
    ])
    renderBoard()

    act(() => {
      queryElement<HTMLButtonElement>('[aria-label="Editar nota"]').click()
    })
    const textarea = queryElement<HTMLTextAreaElement>(
      '[aria-label="Editar texto da nota"]',
    )
    act(() => {
      inputText(textarea, '<img src=x onerror=alert(1)>')
      textarea.blur()
    })

    expect(useBoardStore.getState().notes[0].text).toBe(
      '<img src=x onerror=alert(1)>',
    )
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(container.querySelector('img')).toBeNull()
  })

  it('troca a cor da nota pela paleta', () => {
    useBoardStore.getState().setNotes([createNoteFactory({ id: 'colorful' })])
    renderBoard()

    act(() => {
      queryElement<HTMLButtonElement>(
        '[aria-label="Alterar cor para azul"]',
      ).click()
    })

    expect(useBoardStore.getState().notes[0].color).toBe('blue')
    expect(queryElement('[data-testid="note-colorful"]')).toHaveClass(
      'bg-blue-200',
    )
  })

  it('traz a nota para frente ao iniciar drag e persiste posição com clamp no fim', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({ id: 'dragged', position: { x: 20, y: 30 }, zIndex: 1 }),
      createNoteFactory({ id: 'front', position: { x: 40, y: 60 }, zIndex: 10 }),
    ])
    renderBoard()
    setBoardMetrics(queryElement<HTMLElement>('[data-testid="board"]'), {
      width: 300,
      height: 250,
    })

    act(() => {
      dndKitMock.contextProps.onDragStart?.({ active: { id: 'dragged' } })
      dndKitMock.contextProps.onDragEnd?.({
        active: { id: 'dragged' },
        delta: { x: 500, y: 500 },
      })
    })

    const dragged = useBoardStore
      .getState()
      .notes.find((note) => note.id === 'dragged')
    const front = useBoardStore
      .getState()
      .notes.find((note) => note.id === 'front')

    expect(dragged?.zIndex).toBeGreaterThan(front?.zIndex ?? 0)
    expect(dragged?.position).toEqual({ x: 140, y: 122 })
  })

  it('ignora alinhamento em board vazio', () => {
    const lastModified = useBoardStore.getState().board.lastModified
    renderBoard()

    act(() => {
      window.dispatchEvent(new Event(ALIGN_BOARD_EVENT))
    })

    expect(useBoardStore.getState().notes).toEqual([])
    expect(useBoardStore.getState().board.lastModified).toBe(lastModified)
  })

  it('alinha notas soltas em grid e persiste via autosave', () => {
    vi.useFakeTimers()
    const storage = installLocalStorageMock()
    useBoardStore.getState().setNotes([
      createNoteFactory({
        id: 'later',
        position: { x: 500, y: 300 },
        createdAt: '2026-06-02T12:02:00.000Z',
      }),
      createNoteFactory({
        id: 'earlier',
        position: { x: 300, y: 200 },
        createdAt: '2026-06-02T12:01:00.000Z',
      }),
    ])
    persistence = initializeBoardPersistence({
      storage,
      debounceMs: AUTOSAVE_DELAY_MS,
    })
    renderBoard()
    setBoardMetrics(queryElement<HTMLElement>('[data-testid="board"]'), {
      width: 400,
      height: 400,
    })

    act(() => {
      window.dispatchEvent(new Event(ALIGN_BOARD_EVENT))
    })

    expect(useBoardStore.getState().notes).toMatchObject([
      { id: 'later', position: { x: 184, y: 0 } },
      { id: 'earlier', position: { x: 0, y: 0 } },
    ])

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    })

    const savedState = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as {
      notes?: Array<{ id: string; position: { x: number; y: number } }>
    }
    expect(savedState.notes).toMatchObject([
      { id: 'later', position: { x: 184, y: 0 } },
      { id: 'earlier', position: { x: 0, y: 0 } },
    ])
  })

  it('conta deck recolhido como um slot visual sem espalhar o grupo', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({
        id: 'loose',
        position: { x: 500, y: 300 },
        createdAt: '2026-06-02T12:00:00.000Z',
      }),
      createNoteFactory({
        id: 'deck-back',
        position: { x: 700, y: 300 },
        createdAt: '2026-06-02T12:01:00.000Z',
        groupId: 'deck-1',
        zIndex: 1,
      }),
      createNoteFactory({
        id: 'deck-cover',
        position: { x: 800, y: 300 },
        createdAt: '2026-06-02T12:02:00.000Z',
        groupId: 'deck-1',
        zIndex: 5,
      }),
    ])
    renderBoard()
    setBoardMetrics(queryElement<HTMLElement>('[data-testid="board"]'), {
      width: 400,
      height: 400,
    })

    act(() => {
      window.dispatchEvent(new Event(ALIGN_BOARD_EVENT))
    })

    expect(useBoardStore.getState().notes).toMatchObject([
      { id: 'loose', groupId: null, position: { x: 0, y: 0 } },
      { id: 'deck-back', groupId: 'deck-1', position: { x: 184, y: 0 } },
      { id: 'deck-cover', groupId: 'deck-1', position: { x: 184, y: 0 } },
    ])
    expect(queryElement('[data-testid="deck-deck-1"]')).toHaveTextContent(
      '2 notas',
    )
    expect(container.querySelector('[data-testid="note-deck-back"]')).toBeNull()
    expect(container.querySelector('[data-testid="note-deck-cover"]')).toBeNull()
  })

  it('agrupa nota solta sobre outra e renderiza deck recolhido', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({
        id: 'dragged',
        position: { x: 20, y: 30 },
      }),
      createNoteFactory({
        id: 'target',
        position: { x: 180, y: 150 },
      }),
    ])
    renderBoard()
    setBoardMetrics(queryElement<HTMLElement>('[data-testid="board"]'), {
      width: 600,
      height: 500,
    })

    act(() => {
      dndKitMock.contextProps.onDragEnd?.({
        active: { id: 'dragged' },
        delta: { x: 160, y: 120 },
      })
    })

    const notes = useBoardStore.getState().notes
    expect(notes.find((note) => note.id === 'dragged')).toMatchObject({
      groupId: 'group:target',
      position: { x: 180, y: 150 },
    })
    expect(notes.find((note) => note.id === 'target')).toMatchObject({
      groupId: 'group:target',
    })
    expect(queryElement('[data-testid="deck-group:target"]')).toHaveTextContent(
      '2 notas',
    )
    expect(container.querySelector('[data-testid="note-dragged"]')).toBeNull()
    expect(container.querySelector('[data-testid="note-target"]')).toBeNull()
  })

  it('expande e recolhe deck mantendo as notas do grupo', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({
        id: 'first',
        text: 'Primeira',
        groupId: 'deck-1',
        zIndex: 1,
      }),
      createNoteFactory({
        id: 'second',
        text: 'Segunda',
        groupId: 'deck-1',
        zIndex: 2,
      }),
    ])
    renderBoard()

    expect(queryElement('[data-testid="deck-deck-1"]')).toHaveTextContent(
      '2 notas',
    )
    expect(container.querySelector('[data-testid="note-first"]')).toBeNull()

    act(() => {
      queryElement<HTMLButtonElement>(
        '[aria-label="Expandir deck com 2 notas"]',
      ).click()
    })

    expect(
      queryElement<HTMLButtonElement>('[aria-label="Recolher deck com 2 notas"]'),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(queryElement('[data-testid="note-first"]')).toBeInTheDocument()
    expect(queryElement('[data-testid="note-second"]')).toBeInTheDocument()

    act(() => {
      queryElement<HTMLButtonElement>(
        '[aria-label="Recolher deck com 2 notas"]',
      ).click()
    })

    expect(container.querySelector('[data-testid="note-first"]')).toBeNull()
    expect(container.querySelector('[data-testid="note-second"]')).toBeNull()
  })

  it('desagrupa nota solta fora de outro alvo e desfaz deck unitário', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({
        id: 'remaining',
        position: { x: 20, y: 30 },
        groupId: 'deck-1',
      }),
      createNoteFactory({
        id: 'dragged',
        position: { x: 40, y: 50 },
        groupId: 'deck-1',
      }),
    ])
    renderBoard()
    setBoardMetrics(queryElement<HTMLElement>('[data-testid="board"]'), {
      width: 600,
      height: 500,
    })

    act(() => {
      dndKitMock.contextProps.onDragEnd?.({
        active: { id: 'dragged' },
        delta: { x: 300, y: 0 },
      })
    })

    expect(useBoardStore.getState().notes).toMatchObject([
      { id: 'remaining', groupId: null },
      { id: 'dragged', groupId: null, position: { x: 340, y: 50 } },
    ])
    expect(container.querySelector('[data-testid="deck-deck-1"]')).toBeNull()
  })

  it('ignora self-drop sem mover nem desagrupar', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({
        id: 'self',
        position: { x: 40, y: 50 },
        groupId: 'deck-1',
      }),
      createNoteFactory({ id: 'other', groupId: 'deck-1' }),
    ])
    renderBoard()
    setBoardMetrics(queryElement<HTMLElement>('[data-testid="board"]'), {
      width: 600,
      height: 500,
    })

    act(() => {
      dndKitMock.contextProps.onDragEnd?.({
        active: { id: 'self' },
        delta: { x: 300, y: 0 },
        over: { id: 'self' },
      })
    })

    expect(useBoardStore.getState().notes).toMatchObject([
      { id: 'self', groupId: 'deck-1', position: { x: 40, y: 50 } },
      { id: 'other', groupId: 'deck-1' },
    ])
  })

  it('soltar fora de alvo move normalmente sem criar deck', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({
        id: 'dragged',
        position: { x: 20, y: 30 },
      }),
      createNoteFactory({
        id: 'far-away',
        position: { x: 500, y: 300 },
      }),
    ])
    renderBoard()
    setBoardMetrics(queryElement<HTMLElement>('[data-testid="board"]'), {
      width: 800,
      height: 600,
    })

    act(() => {
      dndKitMock.contextProps.onDragEnd?.({
        active: { id: 'dragged' },
        delta: { x: 100, y: 20 },
      })
    })

    expect(useBoardStore.getState().notes).toMatchObject([
      { id: 'dragged', groupId: null, position: { x: 120, y: 50 } },
      { id: 'far-away', groupId: null },
    ])
    expect(container.querySelector('[data-testid^="deck-"]')).toBeNull()
  })

  it('renderiza a lixeira como droppable e exibe estado armado', () => {
    dndKitMock.useDroppable.mockReturnValueOnce({
      isOver: true,
      setNodeRef: dndKitMock.setDroppableNodeRef,
    })

    renderBoard()

    expect(dndKitMock.useDroppable).toHaveBeenCalledWith({
      id: TRASH_DROPPABLE_ID,
    })
    expect(queryElement('[data-testid="trash-dropzone"]')).toHaveAttribute(
      'data-armed',
      'true',
    )
  })

  it('prioriza drop na lixeira, anima e remove persistindo via autosave', () => {
    vi.useFakeTimers()
    const storage = installLocalStorageMock()
    useBoardStore.getState().setNotes([
      createNoteFactory({
        id: 'trashable',
        position: { x: 20, y: 30 },
      }),
    ])
    persistence = initializeBoardPersistence({
      storage,
      debounceMs: AUTOSAVE_DELAY_MS,
    })
    renderBoard()
    setBoardMetrics(queryElement<HTMLElement>('[data-testid="board"]'), {
      width: 300,
      height: 250,
    })

    act(() => {
      dndKitMock.contextProps.onDragEnd?.({
        active: { id: 'trashable' },
        delta: { x: 500, y: 500 },
        over: { id: TRASH_DROPPABLE_ID },
      })
    })

    expect(queryElement('[data-testid="note-trashable"]')).toHaveAttribute(
      'data-trash-crumpling',
      'true',
    )
    expect(useBoardStore.getState().notes[0].position).toEqual({ x: 20, y: 30 })

    act(() => {
      vi.advanceTimersByTime(180)
    })

    expect(useBoardStore.getState().notes).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    })

    const savedState = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as {
      notes?: unknown[]
    }
    expect(savedState.notes).toEqual([])
  })

  it('mantém lixeira prioritária mesmo quando há colisão com nota', () => {
    vi.useFakeTimers()
    useBoardStore.getState().setNotes([
      createNoteFactory({
        id: 'trashable',
        position: { x: 20, y: 30 },
      }),
      createNoteFactory({
        id: 'target',
        position: { x: 180, y: 150 },
      }),
    ])
    renderBoard()
    setBoardMetrics(queryElement<HTMLElement>('[data-testid="board"]'), {
      width: 600,
      height: 500,
    })

    act(() => {
      dndKitMock.contextProps.onDragEnd?.({
        active: { id: 'trashable' },
        delta: { x: 160, y: 120 },
        over: { id: TRASH_DROPPABLE_ID },
      })
    })

    act(() => {
      vi.advanceTimersByTime(180)
    })

    expect(useBoardStore.getState().notes).toMatchObject([
      { id: 'target', groupId: null },
    ])
    expect(container.querySelector('[data-testid^="deck-"]')).toBeNull()
  })

  it('não remove nota quando o drag é cancelado antes de soltar', () => {
    vi.useFakeTimers()
    useBoardStore.getState().setNotes([createNoteFactory({ id: 'kept' })])
    renderBoard()

    act(() => {
      dndKitMock.contextProps.onDragStart?.({ active: { id: 'kept' } })
      vi.advanceTimersByTime(180)
    })

    expect(useBoardStore.getState().notes).toHaveLength(1)
    expect(queryElement('[data-testid="note-kept"]')).toHaveAttribute(
      'data-trash-crumpling',
      'false',
    )
  })

  it('clique simples abaixo do threshold abre edição sem mover a nota', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({ id: 'click-note', position: { x: 20, y: 30 } }),
    ])
    renderBoard()

    act(() => {
      queryElement<HTMLButtonElement>('[aria-label="Editar nota"]').click()
    })

    expect(
      queryElement('[aria-label="Editar texto da nota"]'),
    ).toHaveFocus()
    expect(queryElement('[data-testid="note-click-note"]')).toHaveAttribute(
      'data-selected',
      'true',
    )
    expect(useBoardStore.getState().notes[0].position).toEqual({ x: 20, y: 30 })
  })

  it('permite selecionar múltiplas notas com modificador sem editar a segunda', () => {
    useBoardStore.getState().setNotes([
      createNoteFactory({ id: 'first', text: 'Primeira' }),
      createNoteFactory({ id: 'second', text: 'Segunda' }),
    ])
    renderBoard()

    act(() => {
      queryElement<HTMLButtonElement>(
        '[data-testid="note-first"] [aria-label="Editar nota"]',
      ).click()
    })
    act(() => {
      queryElement<HTMLButtonElement>(
        '[data-testid="note-second"] [aria-label="Editar nota"]',
      ).dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    })

    expect(queryElement('[data-testid="note-first"]')).toHaveAttribute(
      'data-selected',
      'true',
    )
    expect(queryElement('[data-testid="note-second"]')).toHaveAttribute(
      'data-selected',
      'true',
    )
    expect(container.querySelector('[aria-label="Editar texto da nota"]')).toBeNull()
  })
})
