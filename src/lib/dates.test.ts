import { describe, expect, it } from 'vitest'
import {
  addDaysToKey,
  formatDateHeading,
  formatDueLabel,
  isDateKey,
  isOverdue,
  isTimeKey,
  nextOccurrence,
  nextOccurrenceFrom,
  parseDateKey,
  toDateKey,
  todayKey,
} from './dates'

// Quinta-feira, 9 de julho de 2026, meio-dia (horário local).
const NOW = new Date(2026, 6, 9, 12, 0)

describe('chaves de data e hora', () => {
  it('valida chaves de data', () => {
    expect(isDateKey('2026-07-09')).toBe(true)
    expect(isDateKey('2026-02-29')).toBe(false) // 2026 não é bissexto
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('09/07/2026')).toBe(false)
    expect(isDateKey(20260709)).toBe(false)
  })

  it('valida chaves de hora', () => {
    expect(isTimeKey('00:00')).toBe(true)
    expect(isTimeKey('23:59')).toBe(true)
    expect(isTimeKey('24:00')).toBe(false)
    expect(isTimeKey('9:30')).toBe(false)
  })

  it('converte Date para chave local e volta', () => {
    expect(toDateKey(NOW)).toBe('2026-07-09')
    expect(todayKey(NOW)).toBe('2026-07-09')
    const parsed = parseDateKey('2026-07-09')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(6)
    expect(parsed.getDate()).toBe(9)
  })

  it('soma dias atravessando meses e anos', () => {
    expect(addDaysToKey('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-07-09', -9)).toBe('2026-06-30')
  })
})

describe('nextOccurrence', () => {
  it('retorna null quando não há recorrência', () => {
    expect(nextOccurrence('2026-07-09', 'none')).toBeNull()
  })

  it('avança diariamente e semanalmente', () => {
    expect(nextOccurrence('2026-07-09', 'daily')).toBe('2026-07-10')
    expect(nextOccurrence('2026-07-09', 'weekly')).toBe('2026-07-16')
  })

  it('pula fim de semana em dias úteis', () => {
    // 10/07/2026 é sexta-feira → próxima ocorrência é segunda 13/07.
    expect(nextOccurrence('2026-07-10', 'weekdays')).toBe('2026-07-13')
    expect(nextOccurrence('2026-07-08', 'weekdays')).toBe('2026-07-09')
  })

  it('ajusta fim de mês em recorrência mensal e anual', () => {
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(nextOccurrence('2026-07-15', 'monthly')).toBe('2026-08-15')
    expect(nextOccurrence('2024-02-29', 'yearly')).toBe('2025-02-28')
  })
})

describe('nextOccurrenceFrom', () => {
  it('avança ocorrências passadas até hoje ou depois', () => {
    expect(nextOccurrenceFrom('2026-07-01', 'daily', NOW)).toBe('2026-07-09')
    expect(nextOccurrenceFrom('2026-06-10', 'weekly', NOW)).toBe('2026-07-15')
  })

  it('mantém a próxima ocorrência quando já está no futuro', () => {
    expect(nextOccurrenceFrom('2026-07-09', 'daily', NOW)).toBe('2026-07-10')
  })
})

describe('isOverdue', () => {
  it('considera atrasada tarefa com data no passado', () => {
    expect(isOverdue({ done: false, dueDate: '2026-07-08', dueTime: null }, NOW)).toBe(true)
    expect(isOverdue({ done: false, dueDate: '2026-07-10', dueTime: null }, NOW)).toBe(false)
  })

  it('hoje sem hora não está atrasada; com hora vencida está', () => {
    expect(isOverdue({ done: false, dueDate: '2026-07-09', dueTime: null }, NOW)).toBe(false)
    expect(isOverdue({ done: false, dueDate: '2026-07-09', dueTime: '11:30' }, NOW)).toBe(true)
    expect(isOverdue({ done: false, dueDate: '2026-07-09', dueTime: '12:30' }, NOW)).toBe(false)
  })

  it('tarefa concluída ou sem data nunca está atrasada', () => {
    expect(isOverdue({ done: true, dueDate: '2026-07-01', dueTime: null }, NOW)).toBe(false)
    expect(isOverdue({ done: false, dueDate: null, dueTime: null }, NOW)).toBe(false)
  })
})

describe('formatDueLabel', () => {
  it('usa rótulos relativos para datas próximas', () => {
    expect(formatDueLabel('2026-07-09', NOW)).toBe('Hoje')
    expect(formatDueLabel('2026-07-10', NOW)).toBe('Amanhã')
    expect(formatDueLabel('2026-07-08', NOW)).toBe('Ontem')
  })

  it('usa dia da semana dentro de 6 dias', () => {
    // 11/07/2026 é sábado.
    expect(formatDueLabel('2026-07-11', NOW).toLowerCase()).toContain('s')
    expect(formatDueLabel('2026-07-11', NOW)).not.toContain('11')
  })

  it('usa data curta para datas distantes e inclui ano quando difere', () => {
    expect(formatDueLabel('2026-08-20', NOW)).toContain('20')
    expect(formatDueLabel('2026-08-20', NOW)).not.toContain('2026')
    expect(formatDueLabel('2027-01-05', NOW)).toContain('2027')
  })
})

describe('formatDateHeading', () => {
  it('prefixa Hoje e Amanhã', () => {
    expect(formatDateHeading('2026-07-09', NOW)).toMatch(/^Hoje · /)
    expect(formatDateHeading('2026-07-10', NOW)).toMatch(/^Amanhã · /)
    expect(formatDateHeading('2026-07-20', NOW)).not.toContain('·')
  })
})
