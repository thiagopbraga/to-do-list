import { describe, expect, it } from 'vitest'
import { createTaskFactory } from '../test/factories'
import {
  compareOpenTasks,
  countByList,
  countOverdue,
  countToday,
  filterByQuery,
  selectAllOpen,
  selectByList,
  selectDone,
  selectScheduled,
  selectToday,
} from './views'

const NOW = new Date(2026, 6, 9, 12, 0) // 09/07/2026

describe('compareOpenTasks', () => {
  it('ordena por data, depois hora, depois prioridade', () => {
    const semData = createTaskFactory({ dueDate: null })
    const amanha = createTaskFactory({ dueDate: '2026-07-10' })
    const hojeSemHora = createTaskFactory({ dueDate: '2026-07-09' })
    const hojeCedo = createTaskFactory({ dueDate: '2026-07-09', dueTime: '08:00' })
    const hojeTarde = createTaskFactory({ dueDate: '2026-07-09', dueTime: '18:00' })

    const sorted = [semData, amanha, hojeSemHora, hojeTarde, hojeCedo].sort(
      compareOpenTasks,
    )
    expect(sorted).toEqual([hojeCedo, hojeTarde, hojeSemHora, amanha, semData])
  })

  it('desempata por prioridade mais alta primeiro', () => {
    const baixa = createTaskFactory({ priority: 'low' })
    const alta = createTaskFactory({ priority: 'high' })
    const nenhuma = createTaskFactory({ priority: 'none' })
    expect([baixa, nenhuma, alta].sort(compareOpenTasks)).toEqual([
      alta,
      baixa,
      nenhuma,
    ])
  })
})

describe('selectToday', () => {
  it('separa atrasadas de tarefas de hoje e ignora concluídas', () => {
    const atrasada = createTaskFactory({ dueDate: '2026-07-01' })
    const hoje = createTaskFactory({ dueDate: '2026-07-09' })
    const futura = createTaskFactory({ dueDate: '2026-07-20' })
    const semData = createTaskFactory({ dueDate: null })
    const concluida = createTaskFactory({ dueDate: '2026-07-09', done: true })

    const { overdue, today } = selectToday(
      [atrasada, hoje, futura, semData, concluida],
      NOW,
    )
    expect(overdue).toEqual([atrasada])
    expect(today).toEqual([hoje])
  })
})

describe('selectScheduled', () => {
  it('agrupa por dia em ordem cronológica', () => {
    const dia10a = createTaskFactory({ dueDate: '2026-07-10', dueTime: '09:00' })
    const dia10b = createTaskFactory({ dueDate: '2026-07-10' })
    const dia12 = createTaskFactory({ dueDate: '2026-07-12' })
    const semData = createTaskFactory({ dueDate: null })

    const sections = selectScheduled([dia12, semData, dia10b, dia10a])
    expect(sections.map((s) => s.key)).toEqual(['2026-07-10', '2026-07-12'])
    expect(sections[0].tasks).toEqual([dia10a, dia10b])
  })
})

describe('selectDone / selectAllOpen / selectByList', () => {
  it('concluídas vêm em ordem de conclusão mais recente', () => {
    const antiga = createTaskFactory({
      done: true,
      completedAt: '2026-07-01T10:00:00.000Z',
    })
    const recente = createTaskFactory({
      done: true,
      completedAt: '2026-07-08T10:00:00.000Z',
    })
    expect(selectDone([antiga, recente])).toEqual([recente, antiga])
  })

  it('filtra abertas e por lista', () => {
    const inbox = createTaskFactory()
    const mercado = createTaskFactory({ listId: 'mercado' })
    const feita = createTaskFactory({ done: true })
    expect(selectAllOpen([inbox, mercado, feita])).toHaveLength(2)
    expect(selectByList([inbox, mercado, feita], 'mercado')).toEqual([mercado])
  })
})

describe('filterByQuery', () => {
  it('ignora acentos e caixa e busca também nas anotações', () => {
    const cafe = createTaskFactory({ title: 'Comprar café' })
    const medico = createTaskFactory({
      title: 'Consulta',
      notes: 'Levar exames ao médico',
    })
    const outra = createTaskFactory({ title: 'Outra coisa' })

    expect(filterByQuery([cafe, medico, outra], 'CAFE')).toEqual([cafe])
    expect(filterByQuery([cafe, medico, outra], 'medico')).toEqual([medico])
    expect(filterByQuery([cafe, medico, outra], '')).toHaveLength(3)
  })
})

describe('contadores', () => {
  it('conta tarefas de hoje (incluindo atrasadas), atrasadas e por lista', () => {
    const tasks = [
      createTaskFactory({ dueDate: '2026-07-01' }),
      createTaskFactory({ dueDate: '2026-07-09' }),
      createTaskFactory({ dueDate: '2026-07-20' }),
      createTaskFactory({ listId: 'mercado' }),
      createTaskFactory({ done: true, dueDate: '2026-07-01' }),
    ]
    expect(countToday(tasks, NOW)).toBe(2)
    expect(countOverdue(tasks, NOW)).toBe(1)
    expect(countByList(tasks, 'mercado')).toBe(1)
  })
})
