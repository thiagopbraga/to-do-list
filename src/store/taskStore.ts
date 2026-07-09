import { create } from 'zustand'
import { generateUuid } from '../lib/uuid'
import { nextOccurrenceFrom } from '../lib/dates'
import {
  INBOX_LIST_ID,
  SCHEMA_VERSION,
  type AppState,
  type Task,
  type TaskInput,
  type TaskList,
  type Theme,
} from '../types/task'

function nowIso(): string {
  return new Date().toISOString()
}

export function createInboxList(timestamp: string = nowIso()): TaskList {
  return {
    id: INBOX_LIST_ID,
    name: 'Entrada',
    color: 'blue',
    createdAt: timestamp,
  }
}

export function createInitialState(): AppState {
  return {
    version: SCHEMA_VERSION,
    settings: { theme: 'light' },
    lists: [createInboxList()],
    tasks: [],
  }
}

export type TaskStore = AppState & {
  addTask: (input?: TaskInput) => Task
  updateTask: (
    id: string,
    patch: Partial<Omit<Task, 'id' | 'createdAt'>>,
  ) => void
  toggleTask: (id: string, now?: Date) => void
  removeTask: (id: string) => void
  clearCompleted: () => void
  addList: (name: string, color?: TaskList['color']) => TaskList
  updateList: (id: string, patch: Partial<Omit<TaskList, 'id' | 'createdAt'>>) => void
  /** Remove a lista e move as tarefas dela para a Entrada. */
  removeList: (id: string) => void
  setTheme: (theme: Theme) => void
  replaceState: (state: AppState) => void
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  ...createInitialState(),

  addTask: (input = {}) => {
    const timestamp = nowIso()
    const state = get()
    const listExists = state.lists.some((list) => list.id === input.listId)
    const task: Task = {
      id: generateUuid(),
      title: (input.title ?? '').trim(),
      notes: input.notes ?? '',
      listId: listExists && input.listId ? input.listId : INBOX_LIST_ID,
      done: false,
      completedAt: null,
      dueDate: input.dueDate ?? null,
      dueTime: input.dueDate ? (input.dueTime ?? null) : null,
      recurrence: input.dueDate ? (input.recurrence ?? 'none') : 'none',
      priority: input.priority ?? 'none',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    set({ tasks: [task, ...state.tasks] })
    return task
  },

  updateTask: (id, patch) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, ...patch, updatedAt: nowIso() } : task,
      ),
    }))
  },

  toggleTask: (id, now = new Date()) => {
    const state = get()
    const task = state.tasks.find((t) => t.id === id)
    if (!task) return
    const timestamp = nowIso()

    if (task.done) {
      set({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? { ...t, done: false, completedAt: null, updatedAt: timestamp }
            : t,
        ),
      })
      return
    }

    const nextDue =
      task.recurrence !== 'none' && task.dueDate
        ? nextOccurrenceFrom(task.dueDate, task.recurrence, now)
        : null

    if (nextDue) {
      // Tarefa recorrente: registra a conclusão como uma cópia e reagenda a
      // original para a próxima ocorrência.
      const completedCopy: Task = {
        ...task,
        id: generateUuid(),
        done: true,
        completedAt: timestamp,
        recurrence: 'none',
        updatedAt: timestamp,
      }
      set({
        tasks: [
          completedCopy,
          ...state.tasks.map((t) =>
            t.id === id ? { ...t, dueDate: nextDue, updatedAt: timestamp } : t,
          ),
        ],
      })
      return
    }

    set({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? { ...t, done: true, completedAt: timestamp, updatedAt: timestamp }
          : t,
      ),
    })
  },

  removeTask: (id) => {
    set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) }))
  },

  clearCompleted: () => {
    set((state) => ({ tasks: state.tasks.filter((task) => !task.done) }))
  },

  addList: (name, color = 'slate') => {
    const list: TaskList = {
      id: generateUuid(),
      name: name.trim(),
      color,
      createdAt: nowIso(),
    }
    set((state) => ({ lists: [...state.lists, list] }))
    return list
  },

  updateList: (id, patch) => {
    set((state) => ({
      lists: state.lists.map((list) =>
        list.id === id ? { ...list, ...patch } : list,
      ),
    }))
  },

  removeList: (id) => {
    if (id === INBOX_LIST_ID) return
    set((state) => ({
      lists: state.lists.filter((list) => list.id !== id),
      tasks: state.tasks.map((task) =>
        task.listId === id
          ? { ...task, listId: INBOX_LIST_ID, updatedAt: nowIso() }
          : task,
      ),
    }))
  },

  setTheme: (theme) => {
    set((state) => ({ settings: { ...state.settings, theme } }))
  },

  replaceState: (nextState) => {
    set({
      version: nextState.version,
      settings: nextState.settings,
      lists: nextState.lists,
      tasks: nextState.tasks,
    })
  },
}))

export function toAppState(state: TaskStore | AppState): AppState {
  return {
    version: state.version,
    settings: state.settings,
    lists: state.lists,
    tasks: state.tasks,
  }
}

export function resetTaskStore(): void {
  useTaskStore.setState(createInitialState())
}
