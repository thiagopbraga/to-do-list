import { expect, test } from '@playwright/test'
import {
  createNote,
  dragNoteBy,
  openCleanBoard,
  waitForPersistedNote,
  waitForPersistedNoteById,
  waitForPersistedNoteMatching,
} from './helpers'

test('board: criar, editar e recarregar mantém o texto', async ({ page }) => {
  await openCleanBoard(page)

  const note = await createNote(page, 'Texto inicial', 140, 140)

  await page.reload()
  await expect(page.getByText('Texto inicial')).toBeVisible()

  await page.getByText('Texto inicial').click()
  await page.getByLabel('Editar texto da nota').fill('Texto editado')
  await page.keyboard.press('Escape')
  await waitForPersistedNote(page, 'Texto editado')

  await page.reload()
  await expect(page.getByText('Texto editado')).toBeVisible()
  await expect(page.getByTestId(`note-${note.id}`)).toBeVisible()
})

test('board: trocar cor e recarregar mantém a cor', async ({ page }) => {
  await openCleanBoard(page)

  const note = await createNote(page, 'Nota colorida', 180, 160)
  await page.getByTestId(`note-${note.id}-color-green`).click()
  await waitForPersistedNoteMatching(
    page,
    note.id,
    (persistedNote) => persistedNote.color === 'green',
  )

  await page.reload()

  await expect(page.getByTestId(`note-${note.id}`)).toHaveClass(/bg-green-200/)
  await expect(page.getByTestId(`note-${note.id}-color-green`)).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('board: arrastar nota e recarregar mantém a posição', async ({ page }) => {
  await openCleanBoard(page)

  const note = await createNote(page, 'Nota arrastável', 220, 180)

  await dragNoteBy(page, page.getByTestId(`note-${note.id}`), { x: 100, y: 80 })
  const movedNote = await waitForPersistedNoteMatching(
    page,
    note.id,
    (persistedNote) =>
      persistedNote.position.x !== note.position.x ||
      persistedNote.position.y !== note.position.y,
  )

  await page.reload()
  await expect(page.getByText('Nota arrastável')).toBeVisible()

  const reloadedNote = await waitForPersistedNoteById(page, note.id)
  expect(reloadedNote.position).toEqual(movedNote.position)
  await expect(page.getByTestId(`note-${note.id}`)).toHaveAttribute(
    'style',
    new RegExp(`left: ${movedNote.position.x}px;.*top: ${movedNote.position.y}px;`),
  )
})
