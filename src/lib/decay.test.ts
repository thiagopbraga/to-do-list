import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getNoteVisualDecay,
  NOTE_DECAY_MIN_SATURATION_FOR_CONTRAST,
  NOTE_DECAY_VISUALS,
} from './decay'

const NOW = '2026-06-20T00:00:00.000Z'

function daysBeforeNow(days: number): string {
  return new Date(new Date(NOW).getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('decay', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('classifica as notas nos limites das faixas', () => {
    expect(getNoteVisualDecay(daysBeforeNow(2.99), NOW).stage).toBe('fresh')
    expect(getNoteVisualDecay(daysBeforeNow(3), NOW).stage).toBe('fading')
    expect(getNoteVisualDecay(daysBeforeNow(13.99), NOW).stage).toBe('fading')
    expect(getNoteVisualDecay(daysBeforeNow(14), NOW).stage).toBe('old')
  })

  it('volta para fresco quando updatedAt é recente', () => {
    expect(getNoteVisualDecay(daysBeforeNow(30), NOW).stage).toBe('old')
    expect(getNoteVisualDecay(NOW, NOW).stage).toBe('fresh')
  })

  it('mantém piso de saturação para preservar contraste visual', () => {
    const oldDecay = getNoteVisualDecay(daysBeforeNow(90), NOW)

    expect(oldDecay.saturation).toBe(NOTE_DECAY_VISUALS.old.saturation)
    expect(oldDecay.saturation).toBeGreaterThanOrEqual(
      NOTE_DECAY_MIN_SATURATION_FOR_CONTRAST,
    )
  })

  it('não escreve em localStorage ao calcular decay', () => {
    const localStorage = {
      setItem: vi.fn(),
    }
    vi.stubGlobal('localStorage', localStorage)

    getNoteVisualDecay(daysBeforeNow(30), NOW)

    expect(localStorage.setItem).not.toHaveBeenCalled()
  })
})
