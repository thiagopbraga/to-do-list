import type { Position } from '../types/board'

export const NOTE_CARD_SIZE = {
  width: 160,
  height: 128,
} as const

type Size = {
  width: number
  height: number
}

type ClientPoint = {
  clientX: number
  clientY: number
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function clampNotePosition(
  position: Position,
  boardSize: Size,
  noteSize: Size = NOTE_CARD_SIZE,
): Position {
  const maxX = Math.max(0, boardSize.width - noteSize.width)
  const maxY = Math.max(0, boardSize.height - noteSize.height)

  return {
    x: clampNumber(position.x, 0, maxX),
    y: clampNumber(position.y, 0, maxY),
  }
}

export function getBoardPoint(
  point: ClientPoint,
  boardElement: HTMLElement,
): Position {
  const rect = boardElement.getBoundingClientRect()

  return {
    x: point.clientX - rect.left + boardElement.scrollLeft,
    y: point.clientY - rect.top + boardElement.scrollTop,
  }
}

export function centerNoteAtPoint(
  point: Position,
  noteSize: Size = NOTE_CARD_SIZE,
): Position {
  return {
    x: point.x - noteSize.width / 2,
    y: point.y - noteSize.height / 2,
  }
}

export function getElementSize(element: HTMLElement): Size {
  const rect = element.getBoundingClientRect()

  return {
    width: element.clientWidth || rect.width,
    height: element.clientHeight || rect.height,
  }
}

export function getCenteredClampedNotePosition(
  point: ClientPoint,
  boardElement: HTMLElement,
): Position {
  return clampNotePosition(
    centerNoteAtPoint(getBoardPoint(point, boardElement)),
    getElementSize(boardElement),
  )
}

export function getDraggedNotePosition(
  position: Position,
  delta: Position,
  boardElement: HTMLElement,
): Position {
  return clampNotePosition(
    {
      x: position.x + delta.x,
      y: position.y + delta.y,
    },
    getElementSize(boardElement),
  )
}
