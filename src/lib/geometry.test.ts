import { describe, expect, it, vi } from 'vitest'
import {
  NOTE_CARD_SIZE,
  centerNoteAtPoint,
  clampNotePosition,
  getBoardPoint,
  getCenteredClampedNotePosition,
  getDraggedNotePosition,
} from './geometry'

function createBoardElement({
  width = 800,
  height = 600,
  left = 0,
  top = 0,
  scrollLeft = 0,
  scrollTop = 0,
} = {}): HTMLElement {
  const element = document.createElement('main')

  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
    scrollLeft: { configurable: true, value: scrollLeft },
    scrollTop: { configurable: true, value: scrollTop },
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

  return element
}

describe('geometry', () => {
  it('centraliza a nota no ponto informado', () => {
    expect(centerNoteAtPoint({ x: 200, y: 180 })).toEqual({
      x: 200 - NOTE_CARD_SIZE.width / 2,
      y: 180 - NOTE_CARD_SIZE.height / 2,
    })
  })

  it('aplica clamp para manter a nota dentro do board', () => {
    expect(
      clampNotePosition(
        { x: 1_000, y: -20 },
        { width: 300, height: 250 },
      ),
    ).toEqual({ x: 140, y: 0 })
  })

  it('considera offset e scroll do board ao calcular o ponto relativo', () => {
    const board = createBoardElement({
      left: 50,
      top: 30,
      scrollLeft: 10,
      scrollTop: 20,
    })

    expect(getBoardPoint({ clientX: 150, clientY: 130 }, board)).toEqual({
      x: 110,
      y: 120,
    })
  })

  it('calcula posição centralizada e limitada para duplo clique', () => {
    const board = createBoardElement({ width: 300, height: 250 })

    expect(
      getCenteredClampedNotePosition({ clientX: 290, clientY: 240 }, board),
    ).toEqual({ x: 140, y: 122 })
  })

  it('soma o delta do drag e limita a posição final', () => {
    const board = createBoardElement({ width: 300, height: 250 })

    expect(
      getDraggedNotePosition({ x: 20, y: 30 }, { x: 500, y: 500 }, board),
    ).toEqual({ x: 140, y: 122 })
  })
})
