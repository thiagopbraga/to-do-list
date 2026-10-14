import { expect, test } from '../fixtures';
import { URL_API } from '../ambiente';
import { criarUsuarioLogado } from '../helpers/auth';
import { banco, providerSubIdDoUsuario } from '../helpers/db';

const CPF_VALIDO = '529.982.247-25';

test('paywall: assina o Essencial com Pix (fake), confirma o pagamento e vê o plano na conta', async ({ page, request }) => {
  const usuario = await criarUsuarioLogado(page, 'paywall', '/planos');

  await expect(page.getByRole('heading', { name: 'Escolha seu plano' })).toBeVisible();
  await page.getByRole('button', { name: 'Assinar Essencial' }).click();

  await expect(page.getByRole('heading', { name: 'Assinar o plano Essencial' })).toBeVisible();
  await page.getByRole('radio', { name: /Pix/ }).check();
  await page.getByLabel('CPF ou CNPJ').fill(CPF_VALIDO);
  await page.getByRole('button', { name: 'Continuar para o pagamento' }).click();

  // QR Code e Pix copia e cola.
  await expect(page.getByRole('heading', { name: 'Pague com Pix' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR Code para pagar com Pix' })).toBeVisible();
  await expect(page.getByLabel('Pix copia e cola')).not.toHaveValue('');
  await expect(page.getByText('Aguardando a confirmação do pagamento…')).toBeVisible();

  const providerSubId = await providerSubIdDoUsuario(usuario.id);
  expect(providerSubId, 'a assinatura pendente deveria existir depois de pedir o Pix').toBeTruthy();
  const pendente = await banco().query('SELECT plano, status FROM subscriptions WHERE user_id = $1', [usuario.id]);
  expect(pendente.rows).toEqual([{ plano: 'essencial', status: 'pendente' }]);

  // O provider fake expõe o webhook assinado pelo próprio servidor; a página descobre por polling.
  const resposta = await request.post(`${URL_API}/v1/webhooks/pagamento/simular`, {
    data: { providerSubId, tipo: 'pagamento_confirmado' },
  });
  expect(resposta.ok()).toBe(true);
  expect(await resposta.json()).toMatchObject({ recebido: true });

  await page.waitForURL('**/conta', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible();
  await expect(page.getByText('Plano Essencial ativo')).toBeVisible();
  await expect(page.getByText(/de 1\.500 cards usados neste mês/)).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Uso da cota mensal de cards' })).toHaveAttribute('aria-valuemax', '1500');

  const ativa = await banco().query('SELECT plano, status FROM subscriptions WHERE user_id = $1', [usuario.id]);
  expect(ativa.rows).toEqual([{ plano: 'essencial', status: 'ativa' }]);
});
