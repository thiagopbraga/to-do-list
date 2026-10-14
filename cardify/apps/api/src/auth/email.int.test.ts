import { eq, magicLinks, sessions, users } from '@cardify/db';
import { COOKIE_SESSAO } from './constantes';
import { caminhoDoLink, Cookies, criarAppAuth, tokenDoEmail, type AppAuth } from './helpers-teste';
import { sha256Hex } from './util';

describe('login por e-mail (magic link)', () => {
  let a: AppAuth;

  beforeAll(async () => {
    a = await criarAppAuth();
  });
  afterAll(() => a.t.fechar());
  beforeEach(async () => {
    await a.t.banco.limpar();
    a.email.mensagens.length = 0;
  });

  const pedir = (email: string, retorno?: string) =>
    a.t.app.inject({ method: 'POST', url: '/v1/auth/email', payload: { email, retorno } });
  const verificar = (url: string, cookies = new Cookies()) =>
    a.t.app.inject({ method: 'GET', url, headers: cookies.header });

  it('fluxo completo: pedir, receber, verificar, cookie de sessão e /me logado', async () => {
    const res = await pedir('  Ana@Exemplo.COM ', '/revisar/abc?x=1');

    expect(res.statusCode).toBe(204);
    expect(a.email.mensagens).toHaveLength(1);
    expect(a.email.ultimaMensagem?.para).toBe('ana@exemplo.com');
    const link = new URL(a.email.ultimaMensagem?.link as string);
    expect(link.origin + link.pathname).toBe('http://localhost:4000/v1/auth/email/verificar');
    expect(link.searchParams.get('retorno')).toBe('/revisar/abc?x=1');

    const [guardado] = await a.t.banco.db.select().from(magicLinks);
    const token = tokenDoEmail(a.email);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(guardado.tokenHash).toBe(sha256Hex(token));
    expect(guardado.email).toBe('ana@exemplo.com');
    expect(guardado.usadoEm).toBeNull();
    const ttl = guardado.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(14 * 60_000);
    expect(ttl).toBeLessThanOrEqual(15 * 60_000);

    const ver = await verificar(caminhoDoLink(a.email));
    expect(ver.statusCode).toBe(302);
    expect(ver.headers.location).toBe('http://localhost:3000/revisar/abc?x=1');
    const cookies = new Cookies().absorver(ver);
    expect(cookies.obter(COOKIE_SESSAO)).toBeDefined();

    const [usuario] = await a.t.banco.db.select().from(users);
    expect(usuario.email).toBe('ana@exemplo.com');
    expect(usuario.emailVerificadoEm).not.toBeNull();
    const me = await a.t.app.inject({ method: 'GET', url: '/v1/me', headers: cookies.header });
    expect(me.json()).toEqual({ usuario: { id: usuario.id, email: 'ana@exemplo.com', nome: null }, anonimo: false });
  });

  it('segundo login com o mesmo e-mail reaproveita o usuário', async () => {
    await pedir('ana@exemplo.com');
    await verificar(caminhoDoLink(a.email));
    await pedir('ana@exemplo.com');
    await verificar(caminhoDoLink(a.email));

    expect(await a.t.banco.db.select().from(users)).toHaveLength(1);
    expect(await a.t.banco.db.select().from(sessions)).toHaveLength(2);
  });

  it('link usado uma vez não vale de novo', async () => {
    await pedir('ana@exemplo.com');
    const caminho = caminhoDoLink(a.email);
    expect((await verificar(caminho)).headers.location).toBe('http://localhost:3000/');

    const segunda = await verificar(caminho);
    expect(segunda.statusCode).toBe(302);
    expect(segunda.headers.location).toBe('http://localhost:3000/entrar?erro=link_invalido');
    expect(segunda.cookies.find((c) => c.name === COOKIE_SESSAO)).toBeUndefined();
  });

  it('link expirado, token desconhecido e token ausente vão para o erro', async () => {
    await pedir('ana@exemplo.com');
    await a.t.banco.db.update(magicLinks).set({ expiresAt: new Date(Date.now() - 1000) });

    const esperado = 'http://localhost:3000/entrar?erro=link_invalido';
    expect((await verificar(caminhoDoLink(a.email))).headers.location).toBe(esperado);
    expect((await verificar('/v1/auth/email/verificar?token=inexistente')).headers.location).toBe(esperado);
    expect((await verificar('/v1/auth/email/verificar')).headers.location).toBe(esperado);
    expect(await a.t.banco.db.select().from(users)).toHaveLength(0);
  });

  it('aceita no máximo 5 links por e-mail por hora', async () => {
    for (let i = 0; i < 5; i++) expect((await pedir('ana@exemplo.com')).statusCode).toBe(204);

    const sexto = await pedir('Ana@exemplo.com');
    expect(sexto.statusCode).toBe(429);
    expect(sexto.json()).toEqual({ erro: 'muitas_tentativas' });
    expect(a.email.mensagens).toHaveLength(5);

    expect((await pedir('outra@exemplo.com')).statusCode).toBe(204);

    await a.t.banco.db
      .update(magicLinks)
      .set({ createdAt: new Date(Date.now() - 2 * 3_600_000) })
      .where(eq(magicLinks.email, 'ana@exemplo.com'));
    expect((await pedir('ana@exemplo.com')).statusCode).toBe(204);
  });

  it('pedidos simultâneos não furam o limite', async () => {
    const respostas = await Promise.all(Array.from({ length: 8 }, () => pedir('ana@exemplo.com')));

    expect(respostas.filter((r) => r.statusCode === 204)).toHaveLength(5);
    expect(respostas.filter((r) => r.statusCode === 429)).toHaveLength(3);
  });

  it('e-mail inválido responde 400 sem enviar nada', async () => {
    expect((await pedir('isso-nao-e-email')).statusCode).toBe(400);
    expect(a.email.mensagens).toHaveLength(0);
  });

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '/ok\r\nSet-Cookie: x=1'])(
    'retorno malicioso %j cai em /',
    async (retorno) => {
      await pedir('ana@exemplo.com', retorno);
      const url = new URL(a.email.ultimaMensagem?.link as string);
      expect(url.searchParams.get('retorno')).toBe('/');

      const token = tokenDoEmail(a.email);
      const ver = await verificar(`/v1/auth/email/verificar?token=${token}&retorno=${encodeURIComponent(retorno)}`);
      expect(ver.statusCode).toBe(302);
      expect(ver.headers.location).toBe('http://localhost:3000/');
    },
  );
});
