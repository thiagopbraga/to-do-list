import { expect, test } from '@playwright/test'
import {
  addTaskViaQuickAdd,
  goToView,
  LEGACY_STORAGE_KEY,
  openCleanApp,
  readPersistedState,
} from './helpers'

type PersistedState = {
  version: string
  tasks: Array<{ title: string; dueDate: string | null; done: boolean }>
}

function localDateKey(daysFromToday = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

test('smoke: app abre na visão Hoje', async ({ page }) => {
  await openCleanApp(page)
  await expect(page.getByText('Tudo em dia por hoje! 🎉')).toBeVisible()
})

test('adiciona tarefa pelo quick add e persiste após reload', async ({ page }) => {
  await openCleanApp(page)
  await addTaskViaQuickAdd(page, 'Comprar pão')

  await expect
    .poll(async () => {
      const state = (await readPersistedState(page)) as PersistedState | null
      return state?.tasks.map((task) => task.title) ?? []
    })
    .toContain('Comprar pão')

  await page.reload()
  await expect(page.getByText('Comprar pão')).toBeVisible()
})

test('quick add na visão Hoje agenda para hoje', async ({ page }) => {
  await openCleanApp(page)
  await addTaskViaQuickAdd(page, 'Regar plantas')

  await expect
    .poll(async () => {
      const state = (await readPersistedState(page)) as PersistedState | null
      return state?.tasks[0]?.dueDate
    })
    .toBe(localDateKey())
})

test('conclui tarefa e ela aparece em Concluídas', async ({ page }) => {
  await openCleanApp(page)
  await addTaskViaQuickAdd(page, 'Lavar louça')

  await page.getByRole('checkbox', { name: 'Concluir "Lavar louça"' }).click()
  await expect(page.getByText('Tudo em dia por hoje! 🎉')).toBeVisible()

  const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' })
  if (await bottomNav.isVisible()) {
    await bottomNav.getByRole('button', { name: 'Listas' }).click()
    await page.getByRole('main').getByRole('button', { name: /Concluídas/ }).click()
  } else {
    await goToView(page, 'Concluídas')
  }
  await expect(
    page.getByRole('heading', { level: 1, name: 'Concluídas' }),
  ).toBeVisible()
  await expect(page.getByText('Lavar louça')).toBeVisible()
})

test('agenda tarefa para amanhã pelo editor e vê em Agendadas', async ({ page }) => {
  await openCleanApp(page)
  await addTaskViaQuickAdd(page, 'Dentista')

  await page.getByText('Dentista').click()
  const dialog = page.getByRole('dialog', { name: 'Editar tarefa' })
  await dialog.getByLabel('Data').fill(localDateKey(1))
  await dialog.getByLabel('Hora').fill('14:30')
  await dialog.getByRole('button', { name: 'Salvar' }).click()

  await goToView(page, 'Agendadas')
  await expect(page.getByRole('heading', { name: /^Amanhã · / })).toBeVisible()
  await expect(page.getByText('Dentista')).toBeVisible()
  await expect(page.getByText('14:30')).toBeVisible()
})

test('migra notas do StickyFlow legado para tarefas', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(
    ([legacyKey]) => {
      localStorage.clear()
      localStorage.setItem(
        legacyKey,
        JSON.stringify({
          version: '1.0',
          board: { lastModified: new Date().toISOString(), theme: 'light' },
          notes: [
            {
              id: 'n1',
              text: 'Nota antiga\ncom detalhes',
              color: 'yellow',
              position: { x: 0, y: 0 },
              zIndex: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              groupId: null,
            },
          ],
        }),
      )
    },
    [LEGACY_STORAGE_KEY],
  )
  await page.reload()

  await goToView(page, 'Todas')
  await expect(page.getByText('Nota antiga')).toBeVisible()
})

test('navegação principal correta por viewport', async ({ page, isMobile }) => {
  await openCleanApp(page)
  const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' })
  const sidebar = page.getByRole('navigation', { name: 'Visões' })
  if (isMobile) {
    await expect(bottomNav).toBeVisible()
    await expect(sidebar).toBeHidden()
  } else {
    await expect(sidebar).toBeVisible()
    await expect(bottomNav).toBeHidden()
  }
})
