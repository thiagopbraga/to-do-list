import path from 'node:path';
import { expect, test } from '../fixtures';
import { FIXTURES } from '../ambiente';

test.describe('erros visíveis', () => {
  test('PDF escaneado: a tela de geração explica que o arquivo não tem texto', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/Arraste o PDF aqui/).setInputFiles(path.join(FIXTURES, 'pdf/escaneado.pdf'));
    await page.getByRole('button', { name: 'Gerar amostra grátis' }).click();

    await page.waitForURL(/\/gerar\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Não conseguimos gerar os cards' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('alert').filter({ hasText: /escaneado/i })).toContainText(
      'Este arquivo parece escaneado (sem camada de texto)',
    );
    await expect(page.getByRole('link', { name: 'Tentar de novo' })).toBeVisible();
  });

  test('texto com menos de 50 caracteres: validação no formulário, sem criar geração', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Colar texto' }).click();
    await page.getByLabel('Texto do material').fill('Texto curto demais para gerar cards.');
    await page.getByRole('button', { name: 'Gerar amostra grátis' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'pelo menos 50 caracteres' })).toHaveText(
      'O texto precisa ter pelo menos 50 caracteres.',
    );
    await expect(page).toHaveURL(/\/$/);
  });
});
