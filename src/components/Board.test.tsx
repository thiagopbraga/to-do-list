import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetBoardStore, useBoardStore } from '../store/boardStore'
import { createNoteFactory, resetNoteFactoryCounter } from '../test/factories'
import type { NoteColor } from '../types/board'
import { Board } from './Board'

type CapturedDndContextProps = {
  onDragStart?: (event: { active: { id: string } }) => void
  onDragEnd?: (event: {
    active: { id: string }
    delta: { x: number; y: number }
  }) => void
}

const dndKitMock = vi.hoisted(() => ({
  contextProps: {} as CapturedDndContextProps,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  setNodeRef: vi.fn(),
  useSensor: vi.fn((sensor: unknown, options?: unknown) => ({ sensor, options })),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
  useDraggable: vi.fn(),
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

  beforeEach(() => {
    resetNoteFactoryCounter()
    resetBoardStore()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    dndKitMock.contextProps = {}
    dndKitMock.setNodeRef.mockReset()
    dndKitMock.useSensor.mockClear()
    dndKitMock.useSensors.mockClear()
    dndKitMock.useDraggable.mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: dndKitMock.setNodeRef,
      transform: null,
      isDragging: false,
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.clearAllMocks()
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
    expect(useBoardStore.getState().notes[0].position).toEqual({ x: 20, y: 30 })
  })
})
