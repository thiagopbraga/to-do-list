import type { ListColor, Priority, Recurrence } from '../types/task'

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Não repetir',
  daily: 'Todos os dias',
  weekdays: 'Dias úteis (seg–sex)',
  weekly: 'Toda semana',
  monthly: 'Todo mês',
  yearly: 'Todo ano',
}

export const RECURRENCE_BADGES: Record<Exclude<Recurrence, 'none'>, string> = {
  daily: 'diária',
  weekdays: 'dias úteis',
  weekly: 'semanal',
  monthly: 'mensal',
  yearly: 'anual',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: 'Nenhuma',
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

/**
 * Classes literais por cor para o Tailwind conseguir extrair estaticamente.
 */
export const LIST_COLOR_DOT: Record<ListColor, string> = {
  slate: 'bg-slate-400',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-400',
  green: 'bg-green-500',
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
}

export const PRIORITY_FLAG_CLASS: Record<Exclude<Priority, 'none'>, string> = {
  low: 'text-sky-500',
  medium: 'text-amber-500',
  high: 'text-red-500',
}

export const PRIORITY_CHECKBOX_CLASS: Record<Priority, string> = {
  none: 'border-slate-300 dark:border-slate-500',
  low: 'border-sky-400',
  medium: 'border-amber-400',
  high: 'border-red-400',
}
