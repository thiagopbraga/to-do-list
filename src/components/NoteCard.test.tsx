import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNoteFactory, resetNoteFactoryCounter } from '../test/factories'
import { NOTE_DECAY_VISUALS } from '../lib/decay'
import type { Note } from '../types/board'
import { NoteCard } from './NoteCard'

const dndKitMock = vi.hoisted(() => ({
  setNodeRef: vi.fn(),
  useDraggable: vi.fn(),
}))

vi.mock('@dnd-kit/core', () => ({
  useDraggable: dndKitMock.useDraggable,
}))

type RenderOptions = {
  note?: Note
  isEditing?: boolean
}

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function renderNoteCard({ note, isEditing = false }: RenderOptions = {}) {
  const props = {
    note: note ?? createNoteFactory({ id: 'note-card' }),
    isEditing,
    onEditStart: vi.fn(),
    onEditEnd: vi.fn(),
    onTextChange: vi.fn(),
    onColorChange: vi.fn(),
  }

  act(() => {
    root.render(<NoteCard {...props} />)
  })

  return { container, props }
}

function inputText(textarea: HTMLTextAreaElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set

  valueSetter?.call(textarea, value)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('NoteCard', () => {
  beforeEach(() => {
    resetNoteFactoryCounter()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    dndKitMock.setNodeRef.mockReset()
    dndKitMock.useDraggable.mockReturnValue({
      attributes: { role: 'button' },
      listeners: {},
      setNodeRef: dndKitMock.setNodeRef,
      transform: { x: 12, y: -4, scaleX: 1, scaleY: 1 },
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

  it('renderiza texto como texto puro e preserva quebras de linha', () => {
    const note = createNoteFactory({
      id: 'safe-text',
      text: '<img src=x onerror=alert(1)>\n<script>alert(1)</script>',
    })

    renderNoteCard({ note })

    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('[aria-label="Editar nota"]')).toHaveClass(
      'whitespace-pre-wrap',
    )
  })

  it('entra em edição ao clicar no texto da nota', () => {
    const { props } = renderNoteCard()
    const editButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Editar nota"]',
    )

    act(() => {
      editButton?.click()
    })

    expect(props.onEditStart).toHaveBeenCalledWith('note-card')
  })

  it('vincula o textarea aos callbacks de edição', () => {
    const { props } = renderNoteCard({ isEditing: true })
    const textarea = container.querySelector<HTMLTextAreaElement>(
      '[aria-label="Editar texto da nota"]',
    )

    expect(textarea).toHaveFocus()

    act(() => {
      inputText(textarea!, 'Texto editado')
      textarea!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })

    expect(props.onTextChange).toHaveBeenCalledWith('note-card', 'Texto editado')
    expect(props.onEditEnd).toHaveBeenCalled()
  })

  it('exibe a paleta e troca a cor escolhida', () => {
    const { props } = renderNoteCard({
      note: createNoteFactory({ id: 'color-note', color: 'pink' }),
    })

    expect(
      container.querySelector('[data-testid="note-color-note-color-pink"]'),
    ).toHaveAttribute('aria-pressed', 'true')

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Alterar cor para azul"]')
        ?.click()
    })

    expect(props.onColorChange).toHaveBeenCalledWith('color-note', 'blue')
  })

  it('aplica translate3d recebido do useDraggable', () => {
    renderNoteCard()

    expect(container.querySelector('[data-testid="note-note-card"]')).toHaveStyle({
      transform: 'translate3d(12px, -4px, 0)',
    })
  })

  it('aplica envelhecimento visual derivado de updatedAt', () => {
    renderNoteCard({
      note: createNoteFactory({
        id: 'old-note',
        updatedAt: '2020-01-01T00:00:00.000Z',
      }),
    })

    expect(container.querySelector('[data-testid="note-old-note"]')).toHaveAttribute(
      'data-decay-stage',
      'old',
    )
    expect(container.querySelector('[data-testid="note-old-note"]')).toHaveStyle({
      filter: `saturate(${NOTE_DECAY_VISUALS.old.saturation})`,
    })
  })
})
