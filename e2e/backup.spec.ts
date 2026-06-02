import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  confirmImport,
  createNote,
  dragNoteBy,
  openCleanBoard,
  readPersistedState,
  waitForPersistedNoteMatching,
  waitForPersistedNoteCount,
} from './helpers'

test('backup: exportar e importar restaura o quadro', async ({ page }) => {
  await openCleanBoard(page)

  const exportedNote = await createNote(page, 'Nota exportada', 120, 120)
  await page.getByTestId(`note-${exportedNote.id}-color-blue`).click()
  await expect(page.getByTestId(`note-${exportedNote.id}`)).toHaveClass(/bg-blue-200/)

  await dragNoteBy(page, page.getByTestId(`note-${exportedNote.id}`), {
    x: 90,
    y: 70,
  })
  const expectedNote = await waitForPersistedNoteMatching(
    page,
    exportedNote.id,
    (persistedNote) =>
      persistedNote.color === 'blue' &&
      (persistedNote.position.x !== exportedNote.position.x ||
        persistedNote.position.y !== exportedNote.position.y),
  )

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(
    /^stickyflow-backup-\d{4}-\d{2}-\d{2}\.json$/,
  )
  const backupPath = await download.path()
  if (!backupPath) throw new Error('Backup não foi baixado')
  const exportedState = JSON.parse(await readFile(backupPath, 'utf8')) as Awaited<
    ReturnType<typeof readPersistedState>
  >
  expect(exportedState?.notes).toMatchObject([expectedNote])

  await createNote(page, 'Nota temporária', 320, 180)
  await expect(page.getByText('Nota temporária')).toBeVisible()

  await page.getByLabel('Selecionar arquivo de importação').setInputFiles(backupPath)
  await confirmImport(page)

  await expect(page.getByText('Nota exportada')).toBeVisible()
  await expect(page.getByText('Nota temporária')).toHaveCount(0)
  await waitForPersistedNoteCount(page, 1)

  const restoredState = await readPersistedState(page)
  expect(restoredState?.notes).toEqual(exportedState?.notes)
})
