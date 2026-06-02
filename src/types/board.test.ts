import { describe, expect, it } from 'vitest'
import { NOTE_COLORS, SCHEMA_VERSION } from './board'
import { isNoteColor } from '../test/factories'

describe('board types / schema v1.0', () => {
  it('SCHEMA_VERSION é 1.0', () => {
    expect(SCHEMA_VERSION).toBe('1.0')
  })

  it('NOTE_COLORS contém exatamente as 6 cores do contrato', () => {
    expect(NOTE_COLORS).toHaveLength(6)
    expect(NOTE_COLORS).toEqual([
      'yellow',
      'pink',
      'blue',
      'green',
      'purple',
      'orange',
    ])
  })

  it('cada cor em NOTE_COLORS é um NoteColor válido', () => {
    for (const color of NOTE_COLORS) {
      expect(isNoteColor(color)).toBe(true)
    }
  })
})
