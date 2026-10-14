import { expect, type Page } from '@playwright/test';
import { URL_API } from '../ambiente';
import { emailUnico, inserirMagicLink, usuarioPorEmail, type UsuarioRow } from './db';

/**
 * Login sem e-mail real: grava o magic link no banco e abre o link de verificação da API, o que
 * exercita a verificação, a criação da sessão e o vínculo do trabalho anônimo (cookie `cardify_anon`).
 */
export async function entrarPorMagicLink(page: Page, email: string, retorno = '/'): Promise<void> {
  const token = await inserirMagicLink(email);
  const url = new URL('/v1/auth/email/verificar', URL_API);
  url.searchParams.set('token', token);
  url.searchParams.set('retorno', retorno);
  await page.goto(url.toString());
}

/** Cria o usuário (via verificação do magic link) e deixa a página logada em `retorno`. */
export async function criarUsuarioLogado(page: Page, prefixo: string, retorno = '/'): Promise<UsuarioRow> {
  const email = emailUnico(prefixo);
  await entrarPorMagicLink(page, email, retorno);
  await page.waitForURL((url) => url.pathname === new URL(retorno, 'http://x').pathname);
  const usuario = await usuarioPorEmail(email);
  expect(usuario, 'o usuário deveria ter sido criado pela verificação do magic link').not.toBeNull();
  return usuario as UsuarioRow;
}
