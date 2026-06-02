import { describe, expect, it } from 'vitest'
import { NOTE_COLORS } from '../types/board'
import {
  getNoteColorClasses,
  normalizeNoteColor,
  NOTE_COLOR_CLASSES,
} from './noteColors'

describe('noteColors', () => {
  it('retorna classes para todas as cores da paleta', () => {
    expect(Object.keys(NOTE_COLOR_CLASSES).sort()).toEqual(
      [...NOTE_COLORS].sort(),
    )

    for (const color of NOTE_COLORS) {
      expect(getNoteColorClasses(color)).toBe(NOTE_COLOR_CLASSES[color])
      expect(getNoteColorClasses(color)).toContain(`bg-${color}-200`)
    }
  })

  it('retorna amarelo quando a cor é desconhecida', () => {
    expect(getNoteColorClasses('chartreuse')).toBe(NOTE_COLOR_CLASSES.yellow)
    expect(getNoteColorClasses(undefined)).toBe(NOTE_COLOR_CLASSES.yellow)
    expect(normalizeNoteColor('chartreuse')).toBe('yellow')
  })
})
