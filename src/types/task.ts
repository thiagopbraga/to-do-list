export const SCHEMA_VERSION = '2.0' as const

export const INBOX_LIST_ID = 'inbox' as const

export type Priority = 'none' | 'low' | 'medium' | 'high'

export const PRIORITIES: readonly Priority[] = [
  'none',
  'low',
  'medium',
  'high',
] as const

export type Recurrence =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'yearly'

export const RECURRENCES: readonly Recurrence[] = [
  'none',
  'daily',
  'weekdays',
  'weekly',
  'monthly',
  'yearly',
] as const

export type ListColor =
  | 'slate'
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'teal'
  | 'blue'
  | 'violet'
  | 'pink'

export const LIST_COLORS: readonly ListColor[] = [
  'slate',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
] as const

export type Task = {
  id: string
  title: string
  notes: string
  listId: string
  done: boolean
  completedAt: string | null
  /** Data agendada no formato local YYYY-MM-DD (null = sem data). */
  dueDate: string | null
  /** Hora agendada no formato HH:mm (só faz sentido com dueDate). */
  dueTime: string | null
  recurrence: Recurrence
  priority: Priority
  createdAt: string
  updatedAt: string
}

export type TaskList = {
  id: string
  name: string
  color: ListColor
  createdAt: string
}

export type Theme = 'light' | 'dark'

export type AppSettings = {
  theme: Theme
}

export type AppState = {
  version: typeof SCHEMA_VERSION
  settings: AppSettings
  lists: TaskList[]
  tasks: Task[]
}

export type TaskInput = Partial<
  Pick<
    Task,
    | 'title'
    | 'notes'
    | 'listId'
    | 'dueDate'
    | 'dueTime'
    | 'recurrence'
    | 'priority'
  >
>

export type SmartView = 'today' | 'scheduled' | 'all' | 'done'

/** Visão ativa: uma smart view, uma lista específica ou o índice de listas (mobile). */
export type ViewSelection =
  | { kind: 'smart'; view: SmartView }
  | { kind: 'list'; listId: string }
  | { kind: 'lists-index' }
