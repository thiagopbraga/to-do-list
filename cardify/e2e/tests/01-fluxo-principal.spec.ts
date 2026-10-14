import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../fixtures';
import { FIXTURES } from '../ambiente';
import { entrarPorMagicLink } from '../helpers/auth';
import { importarNoAnki } from '../helpers/apkg';
import { cardsDoJob, emailUnico, jobPorId, usuarioPorEmail } from '../helpers/db';

const TEXTO = fs.readFileSync(path.join(FIXTURES, 'texto/colado.txt'), 'utf8');
// Seis primeiros parágrafos de colado.txt: variante com texto curto (um chunk só).
const TEXTO_CURTO = TEXTO.split(/\n\n+/).slice(0, 6).join('\n\n');
const FRENTE_EDITADA = 'Frente editada no E2E: qual cláusula impede a abolição da forma federativa de Estado?';

async function fluxoPrincipal(page: Page, testInfo: TestInfo, texto: string): Promise<void> {
  // a. Landing: colar o texto e gerar a amostra grátis, sem login.
  await page.goto('/');
  await page.getByRole('tab', { name: 'Colar texto' }).click();
  await page.getByLabel('Texto do material').fill(texto);
  await page.getByRole('button', { name: 'Gerar amostra grátis' }).click();

  // b. Geração: aguarda a conclusão e confere o limite de 10 cards da amostra.
  await page.waitForURL(/\/gerar\/[0-9a-f-]{36}$/);
  const idAmostra = page.url().split('/').pop() as string;
  const resultadoAmostra = page.getByRole('heading', { name: /Sua amostra com|Não conseguimos gerar/ });
  await expect(resultadoAmostra).toBeVisible({ timeout: 60_000 });
  await expect(resultadoAmostra).toHaveText(/Sua amostra com \d+ cards? (está|estão) pronta/);
  const cardsAmostra = page.getByRole('list', { name: 'Cards gerados' }).getByRole('listitem');
  const totalAmostra = await cardsAmostra.count();
  expect(totalAmostra).toBeGreaterThan(0);
  expect(totalAmostra).toBeLessThanOrEqual(10);
  const jobAnonimo = await jobPorId(idAmostra);
  expect(jobAnonimo).toMatchObject({ user_id: null, amostra: true });
  expect(jobAnonimo?.anon_session_id).toBeTruthy();

  // c. CTA para gerar todos os cards leva ao login, preservando o retorno.
  await page.getByRole('link', { name: 'Gerar todos os cards' }).click();
  await page.waitForURL(/\/entrar\?retorno=/);
  const retorno = new URL(page.url()).searchParams.get('retorno');
  expect(retorno).toBe(`/gerar/${idAmostra}`);
  await expect(page.getByRole('heading', { name: 'Entrar no Cardify' })).toBeVisible();

  const email = emailUnico('fluxo');
  await entrarPorMagicLink(page, email, retorno as string);
  await page.waitForURL(`**/gerar/${idAmostra}`);

  // O trabalho anônimo passou a pertencer ao usuário.
  const usuario = await usuarioPorEmail(email);
  expect(usuario).not.toBeNull();
  const jobVinculado = await jobPorId(idAmostra);
  expect(jobVinculado).toMatchObject({ user_id: usuario?.id, anon_session_id: null });
  await expect(page.getByRole('heading', { name: new RegExp(`${totalAmostra} cards? prontos?`) })).toBeVisible();

  // d. Baralho completo (a cota do plano grátis é de 30 cards).
  await page.getByRole('button', { name: 'Gerar o baralho completo' }).click();
  await page.waitForURL((url) => /\/gerar\/[0-9a-f-]{36}$/.test(url.pathname) && !url.pathname.endsWith(idAmostra));
  const idCompleto = page.url().split('/').pop() as string;
  await expect(page.getByRole('heading', { name: /\d+ cards? prontos?/ })).toBeVisible({ timeout: 60_000 });
  const jobCompleto = await jobPorId(idCompleto);
  expect(jobCompleto).toMatchObject({ user_id: usuario?.id, amostra: false });
  expect(['concluido', 'parcial']).toContain(jobCompleto?.status);
  expect(jobCompleto?.cards_gerados).toBeGreaterThan(totalAmostra);

  await page.getByRole('link', { name: 'Revisar e exportar' }).click();
  await page.waitForURL(`**/revisar/${idCompleto}`);
  await expect(page.getByRole('heading', { name: 'Revisar cards' })).toBeVisible();
  const total = (await cardsDoJob(idCompleto)).length;
  await expect(page.getByText(`0 de ${total} cards descartados`)).toBeVisible();

  // e. Editar a frente de um card básico e descartar outro, sem desfazer.
  const basicos = page.getByRole('article').filter({ has: page.getByRole('button', { name: 'Trocar este card para o tipo cloze' }) });
  expect(await basicos.count()).toBeGreaterThanOrEqual(2);

  await basicos.nth(0).getByRole('button', { name: /Editar a frente/ }).click();
  await page.getByRole('textbox', { name: 'Editar a frente' }).fill(FRENTE_EDITADA);
  await page.getByRole('textbox', { name: 'Editar a frente' }).press('Enter');
  await expect(page.getByText('Alteração salva.')).toBeVisible();
  await expect(page.getByRole('article', { name: `Card: ${FRENTE_EDITADA.slice(0, 57)}...` })).toBeVisible();

  await basicos.nth(1).getByRole('button', { name: /^Descartar o card/ }).click();
  await expect(page.getByText('Card descartado.')).toBeVisible();
  await expect(page.getByText(`1 de ${total} cards descartados`)).toBeVisible();
  await expect(page.getByText(`${total - 1} cards ativos`)).toBeVisible();

  const cardsBanco = await cardsDoJob(idCompleto);
  const descartados = cardsBanco.filter((c) => c.estado === 'descartado');
  const editados = cardsBanco.filter((c) => c.estado === 'editado');
  expect(descartados).toHaveLength(1);
  expect(editados).toHaveLength(1);
  expect(editados[0].frente).toBe(FRENTE_EDITADA);
  const ativos = cardsBanco.filter((c) => c.estado !== 'descartado');

  // f. Exportar o .apkg, baixar e importar com o importador oficial do Anki.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar em formato .apkg para o Anki' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.apkg$/);
  const destino = testInfo.outputPath('baralho.apkg');
  await download.saveAs(destino);
  expect(fs.statSync(destino).size).toBeGreaterThan(1000);

  const importado = await importarNoAnki(destino);
  expect(importado.erros).toEqual([]);
  expect(importado.avisos).toEqual([]);
  expect(importado.notas).toBe(ativos.length);
  const camposImportados = importado.detalhe_notas.flatMap((nota) => nota.campos).join('\n');
  expect(camposImportados).toContain(FRENTE_EDITADA);
  expect(camposImportados).not.toContain(descartados[0].verso);
  expect(importado.detalhe_notas.some((n) => n.tipo === 'basico')).toBe(true);
}

test('amostra anônima, login, baralho completo, revisão e exportação (colado.txt completo)', async ({ page }, testInfo) => {
  await fluxoPrincipal(page, testInfo, TEXTO);
});

test('amostra anônima, login, baralho completo, revisão e exportação (texto curto)', async ({ page }, testInfo) => {
  await fluxoPrincipal(page, testInfo, TEXTO_CURTO);
});
