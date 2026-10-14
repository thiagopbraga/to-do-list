import { expect, test } from '../fixtures';
import { criarUsuarioLogado } from '../helpers/auth';
import { banco, usuarioPorEmail } from '../helpers/db';

test('exclusão de conta: confirma com EXCLUIR, volta deslogado e apaga o usuário', async ({ page }) => {
  const usuario = await criarUsuarioLogado(page, 'exclusao', '/conta');
  await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Dados' }).getByText(usuario.email)).toBeVisible();

  const excluir = page.getByRole('button', { name: 'Excluir minha conta e todos os dados' });
  await expect(excluir).toBeDisabled();
  await page.getByLabel(/Digite EXCLUIR para confirmar/).fill('EXCLUIR');
  await excluir.click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Transforme seu PDF em flashcards/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();

  expect(await usuarioPorEmail(usuario.email)).toBeNull();
  const sessoes = await banco().query('SELECT 1 FROM sessions WHERE user_id = $1', [usuario.id]);
  expect(sessoes.rowCount).toBe(0);

  // Deslogado de verdade: a conta redireciona para o login.
  await page.goto('/conta');
  await expect(page).toHaveURL(/\/entrar\?retorno=%2Fconta/);
});
