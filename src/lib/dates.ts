import type { Recurrence, Task } from '../types/task'

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_KEY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function isTimeKey(value: unknown): value is string {
  return typeof value === 'string' && TIME_KEY_PATTERN.test(value)
}

/** Converte uma data para a chave local YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Converte uma chave YYYY-MM-DD para Date à meia-noite local. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now)
}

export function addDaysToKey(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function addMonthsClamped(key: string, months: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const target = new Date(year, month - 1 + months, 1)
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate()
  target.setDate(Math.min(day, lastDay))
  return toDateKey(target)
}

/**
 * Próxima ocorrência estritamente após a data dada, segundo a recorrência.
 * Retorna null para 'none'.
 */
export function nextOccurrence(key: string, rule: Recurrence): string | null {
  switch (rule) {
    case 'none':
      return null
    case 'daily':
      return addDaysToKey(key, 1)
    case 'weekdays': {
      let next = addDaysToKey(key, 1)
      while ([0, 6].includes(parseDateKey(next).getDay())) {
        next = addDaysToKey(next, 1)
      }
      return next
    }
    case 'weekly':
      return addDaysToKey(key, 7)
    case 'monthly':
      return addMonthsClamped(key, 1)
    case 'yearly':
      return addMonthsClamped(key, 12)
  }
}

/**
 * Próxima ocorrência que ainda não passou: avança a partir da data agendada
 * até chegar em hoje ou depois (evita reagendar tarefa recorrente atrasada
 * para outra data no passado).
 */
export function nextOccurrenceFrom(
  key: string,
  rule: Recurrence,
  now: Date = new Date(),
): string | null {
  let next = nextOccurrence(key, rule)
  const today = todayKey(now)
  while (next !== null && next < today) {
    next = nextOccurrence(next, rule)
  }
  return next
}

function currentTimeKey(now: Date): string {
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/** Tarefa aberta cujo prazo já passou (data anterior, ou hoje com hora vencida). */
export function isOverdue(
  task: Pick<Task, 'done' | 'dueDate' | 'dueTime'>,
  now: Date = new Date(),
): boolean {
  if (task.done || !task.dueDate) return false
  const today = todayKey(now)
  if (task.dueDate < today) return true
  if (task.dueDate > today) return false
  return task.dueTime !== null && task.dueTime < currentTimeKey(now)
}

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const DAY_MONTH_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
})
const FULL_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Rótulo curto e humano para uma data: Hoje, Amanhã, Ontem, "sex., 11 de jul." etc. */
export function formatDueLabel(key: string, now: Date = new Date()): string {
  const today = todayKey(now)
  if (key === today) return 'Hoje'
  if (key === addDaysToKey(today, 1)) return 'Amanhã'
  if (key === addDaysToKey(today, -1)) return 'Ontem'

  const date = parseDateKey(key)
  const inSixDays = addDaysToKey(today, 6)
  if (key > today && key <= inSixDays) {
    return capitalize(WEEKDAY_FORMAT.format(date))
  }
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  return sameYear ? DAY_MONTH_FORMAT.format(date) : FULL_FORMAT.format(date)
}

const HEADING_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** Cabeçalho de grupo na visão Agendadas: "Hoje · quinta-feira, 9 de julho". */
export function formatDateHeading(key: string, now: Date = new Date()): string {
  const long = capitalize(HEADING_FORMAT.format(parseDateKey(key)))
  const today = todayKey(now)
  if (key === today) return `Hoje · ${long}`
  if (key === addDaysToKey(today, 1)) return `Amanhã · ${long}`
  return long
}
