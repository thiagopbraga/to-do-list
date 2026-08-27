import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { resetTaskStore, useTaskStore } from './store/taskStore'

beforeEach(() => {
  resetTaskStore()
})

describe('App', () => {
  it('abre na visão Hoje com estado vazio', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hoje' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Tudo em dia por hoje! 🎉')).toBeInTheDocument()
  })

  it('adiciona tarefa pelo quick add com data de hoje', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Adicionar tarefa'), 'Comprar pão')
    await user.keyboard('{Enter}')

    expect(screen.getByText('Comprar pão')).toBeInTheDocument()
    const task = useTaskStore.getState().tasks[0]
    expect(task.dueDate).not.toBeNull()
  })

  it('conclui tarefa pelo checkbox e ela sai da visão Hoje', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Adicionar tarefa'), 'Lavar louça')
    await user.keyboard('{Enter}')
    await user.click(
      screen.getByRole('checkbox', { name: 'Concluir "Lavar louça"' }),
    )

    expect(screen.queryByText('Lavar louça')).not.toBeInTheDocument()
    expect(screen.getByText('Tudo em dia por hoje! 🎉')).toBeInTheDocument()
    expect(useTaskStore.getState().tasks[0].done).toBe(true)
  })

  it('edita tarefa pelo editor completo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Adicionar tarefa'), 'Estudar')
    await user.keyboard('{Enter}')
    await user.click(screen.getByText('Estudar'))

    const dialog = screen.getByRole('dialog', { name: 'Editar tarefa' })
    const titleInput = within(dialog).getByLabelText('Título')
    await user.clear(titleInput)
    await user.type(titleInput, 'Estudar TypeScript')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    expect(screen.getByText('Estudar TypeScript')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('navega para Agendadas e mostra grupos por data', async () => {
    const user = userEvent.setup()
    useTaskStore.getState().addTask({
      title: 'Dentista',
      dueDate: '2030-01-15',
      dueTime: '14:30',
    })
    render(<App />)

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    await user.click(within(nav).getByRole('button', { name: 'Agendadas' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Agendadas' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Dentista')).toBeInTheDocument()
    expect(screen.getByText('14:30')).toBeInTheDocument()
  })

  it('cria lista nova e adiciona tarefa nela', async () => {
    const user = userEvent.setup()
    render(<App />)

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    await user.click(within(nav).getByRole('button', { name: 'Listas' }))
    const main = screen.getByRole('main')
    await user.click(within(main).getByRole('button', { name: 'Nova lista' }))

    await user.type(screen.getByLabelText('Nome da lista'), 'Mercado')
    await user.click(screen.getByRole('button', { name: 'Criar lista' }))

    await user.click(within(main).getByRole('button', { name: /^Mercado/ }))
    expect(
      screen.getByRole('heading', { level: 1, name: 'Mercado' }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Adicionar tarefa'), 'Leite')
    await user.keyboard('{Enter}')

    const task = useTaskStore.getState().tasks[0]
    const list = useTaskStore.getState().lists.find((l) => l.name === 'Mercado')
    expect(task.listId).toBe(list?.id)
  })
})
