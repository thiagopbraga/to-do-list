import { expect, type Locator, type Page } from '@playwright/test'

const STORAGE_KEY = 'stickyflow:state'

export type PersistedNote = {
  id: string
  text: string
  color: string
  position: {
    x: number
    y: number
  }
  zIndex: number
  createdAt: string
  updatedAt: string
  groupId: string | null
}

export type PersistedBoardState = {
  version: string
  board: {
    lastModified: string
    theme: string
  }
  notes: PersistedNote[]
}

export async function openCleanBoard(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByTestId('board')).toBeVisible()
}

export async function createNote(
  page: Page,
  text: string,
  x: number,
  y: number,
): Promise<PersistedNote> {
  await page.getByTestId('board').dblclick({ position: { x, y } })
  await page.getByLabel('Editar texto da nota').fill(text)
  await page.keyboard.press('Escape')

  return waitForPersistedNote(page, text)
}

export async function readPersistedState(
  page: Page,
): Promise<PersistedBoardState | null> {
  return page.evaluate((key) => {
    const payload = localStorage.getItem(key)
    return payload ? JSON.parse(payload) : null
  }, STORAGE_KEY)
}

export async function waitForPersistedNote(
  page: Page,
  text: string,
): Promise<PersistedNote> {
  let note: PersistedNote | undefined

  await expect
    .poll(async () => {
      const state = await readPersistedState(page)
      note = state?.notes.find((candidate) => candidate.text === text)
      return note?.id ?? null
    })
    .not.toBeNull()

  return note!
}

export async function waitForPersistedNoteById(
  page: Page,
  id: string,
): Promise<PersistedNote> {
  let note: PersistedNote | undefined

  await expect
    .poll(async () => {
      const state = await readPersistedState(page)
      note = state?.notes.find((candidate) => candidate.id === id)
      return note ? JSON.stringify(note) : null
    })
    .not.toBeNull()

  return note!
}

export async function waitForPersistedNoteMatching(
  page: Page,
  id: string,
  predicate: (note: PersistedNote) => boolean,
): Promise<PersistedNote> {
  let note: PersistedNote | undefined

  await expect
    .poll(async () => {
      const state = await readPersistedState(page)
      note = state?.notes.find((candidate) => candidate.id === id)
      return note && predicate(note) ? JSON.stringify(note) : null
    })
    .not.toBeNull()

  return note!
}

export async function waitForPersistedNoteCount(
  page: Page,
  count: number,
): Promise<void> {
  await expect
    .poll(async () => {
      const state = await readPersistedState(page)
      return state?.notes.length ?? 0
    })
    .toBe(count)
}

export async function importJsonPayload(
  page: Page,
  payload: string,
  filename = 'stickyflow-backup.json',
): Promise<void> {
  await page
    .getByLabel('Selecionar arquivo de importação')
    .setInputFiles({
      name: filename,
      mimeType: 'application/json',
      buffer: Buffer.from(payload),
    })
}

export async function confirmImport(page: Page): Promise<void> {
  await expect(page.getByRole('dialog')).toContainText('Substituir quadro atual?')
  await page.getByRole('button', { name: 'Importar e substituir' }).click()
  await expect(page.getByRole('status')).toHaveText('Quadro restaurado')
}

export async function dragNoteBy(
  page: Page,
  note: Locator,
  delta: { x: number; y: number },
): Promise<void> {
  const box = await note.boundingBox()
  if (!box) throw new Error('Nota não está visível para arrastar')

  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 8 })
  await page.mouse.up()
}
