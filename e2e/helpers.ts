import { expect, type Page } from '@playwright/test'

export const STORAGE_KEY = 'taskflow:state'
export const LEGACY_STORAGE_KEY = 'stickyflow:state'

export async function openCleanApp(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Hoje' })).toBeVisible()
}

/** Navega por uma smart view usando a navegação visível (sidebar ou bottom nav). */
export async function goToView(page: Page, name: string): Promise<void> {
  await page
    .getByRole('button', { name, exact: true })
    .filter({ visible: true })
    .first()
    .click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

export async function addTaskViaQuickAdd(page: Page, title: string): Promise<void> {
  const input = page.getByLabel('Adicionar tarefa')
  await input.fill(title)
  await input.press('Enter')
  await expect(page.getByText(title)).toBeVisible()
}

export async function readPersistedState(page: Page): Promise<unknown> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  }, STORAGE_KEY)
}
