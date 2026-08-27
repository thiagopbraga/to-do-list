import { createInboxList } from '../store/taskStore'
import {
  INBOX_LIST_ID,
  SCHEMA_VERSION,
  type AppState,
  type Task,
  type TaskList,
} from '../types/task'

let taskCounter = 0

export function createTaskFactory(overrides: Partial<Task> = {}): Task {
  taskCounter += 1
  const timestamp = '2026-06-02T12:00:00.000Z'

  return {
    id: `task-${taskCounter}`,
    title: `Tarefa ${taskCounter}`,
    notes: '',
    listId: INBOX_LIST_ID,
    done: false,
    completedAt: null,
    dueDate: null,
    dueTime: null,
    recurrence: 'none',
    priority: 'none',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

export function resetTaskFactoryCounter(): void {
  taskCounter = 0
}

export function createAppStateFactory(
  overrides: Partial<AppState> = {},
): AppState {
  return {
    version: SCHEMA_VERSION,
    settings: { theme: 'light' },
    lists: [createInboxList('2026-06-02T12:00:00.000Z')],
    tasks: [],
    ...overrides,
  }
}

export function createListFactory(overrides: Partial<TaskList> = {}): TaskList {
  return {
    id: `list-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Lista de teste',
    color: 'green',
    createdAt: '2026-06-02T12:00:00.000Z',
    ...overrides,
  }
}
