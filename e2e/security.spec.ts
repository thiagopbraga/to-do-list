import { expect, test } from '@playwright/test'
import {
  confirmImport,
  createNote,
  importJsonPayload,
  openCleanBoard,
  waitForPersistedNote,
  waitForPersistedNoteCount,
} from './helpers'

const MALICIOUS_TEXT =
  '<img src=x onerror="window.__stickyflowXss = true">\n<script>window.__stickyflowXss = true</script>'

function createBackupPayload(text: string): string {
  return JSON.stringify({
    version: '1.0',
    board: {
      lastModified: '2026-06-02T12:00:00.000Z',
      theme: 'light',
    },
    notes: [
      {
        id: 'imported-malicious-note',
        text,
        color: 'yellow',
        position: { x: 120, y: 120 },
        zIndex: 1,
        createdAt: '2026-06-02T12:00:00.000Z',
        updatedAt: '2026-06-02T12:00:00.000Z',
        groupId: null,
      },
    ],
  })
}

test('importação inválida mostra erro e mantém o quadro intacto', async ({ page }) => {
  await openCleanBoard(page)

  await createNote(page, 'Nota preservada', 120, 120)
  await importJsonPayload(page, '{', 'corrompido.json')

  await expect(page.getByRole('alert')).toHaveText('Arquivo inválido')
  await expect(page.getByText('Nota preservada')).toBeVisible()
  await waitForPersistedNoteCount(page, 1)
})

test('anti-XSS: edição e importação renderizam markup como texto literal', async ({
  page,
}) => {
  await openCleanBoard(page)
  await page.evaluate(() => {
    const testWindow = window as Window & { __stickyflowXss?: boolean }
    testWindow.__stickyflowXss = false
  })

  await createNote(page, MALICIOUS_TEXT, 160, 160)
  await expect(
    page.getByText('<img src=x onerror="window.__stickyflowXss = true">'),
  ).toBeVisible()
  await expect(page.locator('[aria-label="Post-it"] img')).toHaveCount(0)
  await expect(page.locator('[aria-label="Post-it"] script')).toHaveCount(0)
  await expect(
    page.evaluate(() => {
      const testWindow = window as Window & { __stickyflowXss?: boolean }
      return testWindow.__stickyflowXss
    }),
  ).resolves.toBe(false)

  await importJsonPayload(page, createBackupPayload(MALICIOUS_TEXT))
  await confirmImport(page)
  await waitForPersistedNote(page, MALICIOUS_TEXT)

  await expect(page.getByText('<script>window.__stickyflowXss = true</script>')).toBeVisible()
  await expect(page.locator('[aria-label="Post-it"] img')).toHaveCount(0)
  await expect(page.locator('[aria-label="Post-it"] script')).toHaveCount(0)
  await expect(
    page.evaluate(() => {
      const testWindow = window as Window & { __stickyflowXss?: boolean }
      return testWindow.__stickyflowXss
    }),
  ).resolves.toBe(false)
})
