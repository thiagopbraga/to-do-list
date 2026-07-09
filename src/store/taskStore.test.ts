import { beforeEach, describe, expect, it } from 'vitest'
import { INBOX_LIST_ID } from '../types/task'
import { resetTaskStore, useTaskStore } from './taskStore'

const NOW = new Date(2026, 6, 9, 12, 0) // 09/07/2026

beforeEach(() => {
  resetTaskStore()
})

describe('addTask', () => {
  it('cria tarefa com padrões seguros e título aparado', () => {
    const task = useTaskStore.getState().addTask({ title: '  Comprar pão  ' })
    expect(task.title).toBe('Comprar pão')
    expect(task.listId).toBe(INBOX_LIST_ID)
    expect(task.done).toBe(false)
    expect(task.dueDate).toBeNull()
    expect(task.recurrence).toBe('none')
    expect(useTaskStore.getState().tasks).toHaveLength(1)
  })

  it('cai para a Entrada quando a lista não existe', () => {
    const task = useTaskStore.getState().addTask({
      title: 'X',
      listId: 'lista-fantasma',
    })
    expect(task.listId).toBe(INBOX_LIST_ID)
  })

  it('ignora hora e recorrência sem data', () => {
    const task = useTaskStore.getState().addTask({
      title: 'X',
      dueTime: '10:00',
      recurrence: 'daily',
    })
    expect(task.dueTime).toBeNull()
    expect(task.recurrence).toBe('none')
  })
})

describe('toggleTask', () => {
  it('conclui e reabre tarefa simples', () => {
    const store = useTaskStore.getState()
    const task = store.addTask({ title: 'Simples' })

    store.toggleTask(task.id, NOW)
    let updated = useTaskStore.getState().tasks[0]
    expect(updated.done).toBe(true)
    expect(updated.completedAt).not.toBeNull()

    useTaskStore.getState().toggleTask(task.id, NOW)
    updated = useTaskStore.getState().tasks[0]
    expect(updated.done).toBe(false)
    expect(updated.completedAt).toBeNull()
  })

  it('reagenda tarefa recorrente e registra a conclusão', () => {
    const store = useTaskStore.getState()
    const task = store.addTask({
      title: 'Academia',
      dueDate: '2026-07-09',
      recurrence: 'daily',
    })

    store.toggleTask(task.id, NOW)
    const tasks = useTaskStore.getState().tasks
    expect(tasks).toHaveLength(2)

    const original = tasks.find((t) => t.id === task.id)
    expect(original?.done).toBe(false)
    expect(original?.dueDate).toBe('2026-07-10')
    expect(original?.recurrence).toBe('daily')

    const registro = tasks.find((t) => t.id !== task.id)
    expect(registro?.done).toBe(true)
    expect(registro?.recurrence).toBe('none')
    expect(registro?.completedAt).not.toBeNull()
  })

  it('reagenda recorrente atrasada para uma data que não seja passada', () => {
    const store = useTaskStore.getState()
    const task = store.addTask({
      title: 'Relatório',
      dueDate: '2026-07-01',
      recurrence: 'weekly',
    })
    store.toggleTask(task.id, NOW)
    const original = useTaskStore
      .getState()
      .tasks.find((t) => t.id === task.id)
    expect(original?.dueDate).toBe('2026-07-15')
  })
})

describe('listas', () => {
  it('cria, atualiza e remove listas movendo tarefas para a Entrada', () => {
    const store = useTaskStore.getState()
    const lista = store.addList('Mercado', 'green')
    const task = useTaskStore
      .getState()
      .addTask({ title: 'Leite', listId: lista.id })
    expect(task.listId).toBe(lista.id)

    useTaskStore.getState().updateList(lista.id, { name: 'Feira' })
    expect(
      useTaskStore.getState().lists.find((l) => l.id === lista.id)?.name,
    ).toBe('Feira')

    useTaskStore.getState().removeList(lista.id)
    const state = useTaskStore.getState()
    expect(state.lists.find((l) => l.id === lista.id)).toBeUndefined()
    expect(state.tasks[0].listId).toBe(INBOX_LIST_ID)
  })

  it('não permite remover a Entrada', () => {
    useTaskStore.getState().removeList(INBOX_LIST_ID)
    expect(
      useTaskStore.getState().lists.some((l) => l.id === INBOX_LIST_ID),
    ).toBe(true)
  })
})

describe('demais ações', () => {
  it('updateTask altera campos e updatedAt', () => {
    const store = useTaskStore.getState()
    const task = store.addTask({ title: 'A' })
    store.updateTask(task.id, { title: 'B', priority: 'high' })
    const updated = useTaskStore.getState().tasks[0]
    expect(updated.title).toBe('B')
    expect(updated.priority).toBe('high')
  })

  it('removeTask e clearCompleted', () => {
    const store = useTaskStore.getState()
    const a = store.addTask({ title: 'A' })
    const b = useTaskStore.getState().addTask({ title: 'B' })
    useTaskStore.getState().toggleTask(b.id, NOW)

    useTaskStore.getState().clearCompleted()
    expect(useTaskStore.getState().tasks.map((t) => t.id)).toEqual([a.id])

    useTaskStore.getState().removeTask(a.id)
    expect(useTaskStore.getState().tasks).toHaveLength(0)
  })

  it('setTheme alterna o tema', () => {
    useTaskStore.getState().setTheme('dark')
    expect(useTaskStore.getState().settings.theme).toBe('dark')
  })
})
