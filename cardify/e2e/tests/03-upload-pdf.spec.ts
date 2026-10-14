import path from 'node:path';
import { expect, test } from '../fixtures';
import { FIXTURES } from '../ambiente';
import { criarUsuarioLogado } from '../helpers/auth';
import { jobPorId } from '../helpers/db';

test('upload de PDF logado: envio direto ao MinIO, geração e cards agrupados por seção', async ({ page }) => {
  const usuario = await criarUsuarioLogado(page, 'upload', '/');

  // O upload é um POST multipart direto do navegador ao MinIO pela política assinada.
  const envioAoStorage = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes(':9000/'));
  await expect(page.getByRole('button', { name: 'Gerar flashcards' })).toBeVisible();
  await page.getByLabel(/Arraste o PDF aqui/).setInputFiles(path.join(FIXTURES, 'pdf/aula-medicina.pdf'));
  await expect(page.getByText('aula-medicina.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Gerar flashcards' }).click();

  const resposta = await envioAoStorage;
  expect(resposta.status(), 'o MinIO deveria aceitar o POST assinado (CORS e política)').toBeLessThan(300);

  await page.waitForURL(/\/gerar\/[0-9a-f-]{36}$/);
  const jobId = page.url().split('/').pop() as string;
  const resultado = page.getByRole('heading', { name: /cards? prontos?|Não conseguimos gerar/ });
  await expect(resultado).toBeVisible({ timeout: 60_000 });
  await expect(resultado).toHaveText(/\d+ cards? prontos?/);
  expect(await jobPorId(jobId)).toMatchObject({ user_id: usuario.id, amostra: false });

  await page.getByRole('link', { name: 'Revisar e exportar' }).click();
  await page.waitForURL(`**/revisar/${jobId}`);
  await expect(page.getByRole('heading', { name: 'Revisar cards' })).toBeVisible();

  // Os cards vêm agrupados pelos títulos do PDF.
  const secoes = page.getByRole('region').filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(secoes.first()).toBeVisible();
  expect(await secoes.count()).toBeGreaterThanOrEqual(2);
  for (const titulo of ['Componentes e funções', 'Sístole e diástole', 'Bulhas cardíacas']) {
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^${titulo}`) })).toBeVisible();
  }
  expect(await page.getByRole('article').count()).toBeGreaterThan(0);
});
