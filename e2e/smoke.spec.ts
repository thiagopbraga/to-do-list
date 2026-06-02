import { expect, test } from '@playwright/test'

test('smoke: board vazio renderiza', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('toolbar')).toBeVisible()
  await expect(page.getByTestId('board')).toBeVisible()
  await expect(page.getByText('StickyFlow')).toBeVisible()
})
