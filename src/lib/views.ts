import { isOverdue, todayKey } from './dates'
import type { Priority, Task } from '../types/task'

const PRIORITY_WEIGHT: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
}

/**
 * Ordena tarefas abertas para exibição: primeiro por data (sem data por
 * último), depois por hora (sem hora por último), prioridade e recência.
 */
export function compareOpenTasks(a: Task, b: Task): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1
    if (b.dueDate === null) return -1
    return a.dueDate < b.dueDate ? -1 : 1
  }
  if (a.dueTime !== b.dueTime) {
    if (a.dueTime === null) return 1
    if (b.dueTime === null) return -1
    return a.dueTime < b.dueTime ? -1 : 1
  }
  const priorityDelta = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
  if (priorityDelta !== 0) return priorityDelta
  return a.createdAt < b.createdAt ? 1 : -1
}

export type TaskSection = {
  key: string
  title: string
  tasks: Task[]
}

function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => !task.done)
}

/** Visão Hoje: atrasadas + agendadas para hoje. */
export function selectToday(
  tasks: Task[],
  now: Date = new Date(),
): { overdue: Task[]; today: Task[] } {
  const today = todayKey(now)
  const open = openTasks(tasks)
  return {
    overdue: open
      .filter((task) => task.dueDate !== null && task.dueDate < today)
      .sort(compareOpenTasks),
    today: open
      .filter((task) => task.dueDate === today)
      .sort(compareOpenTasks),
  }
}

/** Visão Agendadas: tarefas abertas com data, agrupadas por dia. */
export function selectScheduled(tasks: Task[]): TaskSection[] {
  const withDate = openTasks(tasks)
    .filter((task) => task.dueDate !== null)
    .sort(compareOpenTasks)

  const sections: TaskSection[] = []
  for (const task of withDate) {
    const key = task.dueDate as string
    const last = sections[sections.length - 1]
    if (last && last.key === key) {
      last.tasks.push(task)
    } else {
      sections.push({ key, title: key, tasks: [task] })
    }
  }
  return sections
}

/** Visão Todas: abertas de todas as listas (com e sem data). */
export function selectAllOpen(tasks: Task[]): Task[] {
  return openTasks(tasks).sort(compareOpenTasks)
}

/** Tarefas abertas de uma lista específica. */
export function selectByList(tasks: Task[], listId: string): Task[] {
  return openTasks(tasks)
    .filter((task) => task.listId === listId)
    .sort(compareOpenTasks)
}

/** Visão Concluídas: mais recentes primeiro. */
export function selectDone(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => task.done)
    .sort((a, b) =>
      (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt),
    )
}

/** Filtra por texto de busca (título e notas, sem diferenciar acentos/caixa). */
export function filterByQuery(tasks: Task[], query: string): Task[] {
  const normalized = normalize(query)
  if (!normalized) return tasks
  return tasks.filter(
    (task) =>
      normalize(task.title).includes(normalized) ||
      normalize(task.notes).includes(normalized),
  )
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Contadores para badges de navegação. */
export function countToday(tasks: Task[], now: Date = new Date()): number {
  const { overdue, today } = selectToday(tasks, now)
  return overdue.length + today.length
}

export function countOverdue(tasks: Task[], now: Date = new Date()): number {
  return openTasks(tasks).filter((task) => isOverdue(task, now)).length
}

export function countByList(tasks: Task[], listId: string): number {
  return openTasks(tasks).filter((task) => task.listId === listId).length
}
