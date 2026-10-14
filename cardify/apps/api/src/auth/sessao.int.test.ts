import { anonSessions, eq, sessions } from '@cardify/db';
import { carregarEnv, LIMITES_ANONIMO } from '@cardify/shared';
import { COOKIE_ANON, COOKIE_SESSAO } from './constantes';
import { Cookies, criarAppAuth, type AppAuth } from './helpers-teste';
import { sha256Hex } from './util';

describe('sessão anônima e /me', () => {
  let a: AppAuth;

  beforeAll(async () => {
    a = await criarAppAuth();
  });
  afterAll(() => a.t.fechar());
  beforeEach(() => a.t.banco.limpar());

  const post = (cookies: Cookies, url = '/v1/sessao/anonima') =>
    a.t.app.inject({ method: 'POST', url, headers: cookies.header });
  const me = (cookies: Cookies) => a.t.app.inject({ method: 'GET', url: '/v1/me', headers: cookies.header });

  it('cria a sessão anônima com cookie assinado e ip_hash', async () => {
    const res = await post(new Cookies());

    expect(res.statusCode).toBe(204);
    const cookie = res.cookies.find((c) => c.name === COOKIE_ANON);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/', maxAge: LIMITES_ANONIMO.sessaoTtlSegundos });
    expect(cookie?.secure).toBeFalsy();

    const [linha] = await a.t.banco.db.select().from(anonSessions);
    const env = carregarEnv({ NODE_ENV: 'test' });
    expect(cookie?.value.startsWith(`${linha.id}.`)).toBe(true);
    expect(linha.ipHash).toBe(sha256Hex('127.0.0.1' + env.SESSION_SECRET));
    const ttl = linha.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(LIMITES_ANONIMO.sessaoTtlSegundos * 1000 - 60_000);
    expect(ttl).toBeLessThanOrEqual(LIMITES_ANONIMO.sessaoTtlSegundos * 1000);
  });

  it('é idempotente: com sessão anônima válida responde 204 sem mudar nada', async () => {
    const cookies = new Cookies().absorver(await post(new Cookies()));

    const res = await post(cookies);

    expect(res.statusCode).toBe(204);
    expect(res.cookies).toHaveLength(0);
    expect(await a.t.banco.db.select().from(anonSessions)).toHaveLength(1);
  });

  it('ignora cookie adulterado e cria outra sessão', async () => {
    const cookies = new Cookies().absorver(await post(new Cookies()));
    const original = cookies.obter(COOKIE_ANON) as string;
    const adulterado = new Cookies().definir(COOKIE_ANON, original.slice(0, -2) + 'xx');
    const semAssinatura = new Cookies().definir(COOKIE_ANON, original.split('.')[0]);

    expect((await me(adulterado)).json()).toEqual({ usuario: null, anonimo: false });
    expect((await me(semAssinatura)).json()).toEqual({ usuario: null, anonimo: false });

    const res = await post(adulterado);
    expect(res.cookies.find((c) => c.name === COOKIE_ANON)).toBeDefined();
    expect(await a.t.banco.db.select().from(anonSessions)).toHaveLength(2);
  });

  it('ignora sessão anônima expirada e cria outra', async () => {
    const cookies = new Cookies().absorver(await post(new Cookies()));
    await a.t.banco.db.update(anonSessions).set({ expiresAt: new Date(Date.now() - 1000) });

    expect((await me(cookies)).json()).toEqual({ usuario: null, anonimo: false });
    const res = await post(cookies);
    expect(res.cookies.find((c) => c.name === COOKIE_ANON)).toBeDefined();
  });

  it('GET /me nos três estados', async () => {
    expect((await me(new Cookies())).json()).toEqual({ usuario: null, anonimo: false });

    const cookies = new Cookies().absorver(await post(new Cookies()));
    expect((await me(cookies)).json()).toEqual({ usuario: null, anonimo: true });

    await a.t.app.inject({ method: 'POST', url: '/v1/auth/email', payload: { email: 'Ana@Exemplo.com' } });
    const link = new URL(a.email.ultimaMensagem?.link as string);
    const login = await a.t.app.inject({
      method: 'GET',
      url: link.pathname + link.search,
      headers: cookies.header,
    });
    cookies.absorver(login);

    const logado = (await me(cookies)).json();
    expect(logado.anonimo).toBe(false);
    expect(logado.usuario).toMatchObject({ email: 'ana@exemplo.com', nome: null });
    expect(typeof logado.usuario.id).toBe('string');
  });

  it('cookie de sessão de usuário não é assinado e sessão expirada é ignorada', async () => {
    await a.t.app.inject({ method: 'POST', url: '/v1/auth/email', payload: { email: 'ana@exemplo.com' } });
    const link = new URL(a.email.ultimaMensagem?.link as string);
    const login = await a.t.app.inject({ method: 'GET', url: link.pathname + link.search });
    const cookies = new Cookies().absorver(login);

    const token = cookies.obter(COOKIE_SESSAO) as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const cookie = login.cookies.find((c) => c.name === COOKIE_SESSAO);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 30 * 24 * 60 * 60 });

    const [linha] = await a.t.banco.db.select().from(sessions);
    expect(linha.id).toBe(sha256Hex(token));

    await a.t.banco.db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, linha.id));
    expect((await me(cookies)).json()).toEqual({ usuario: null, anonimo: false });
  });

  it('rota protegida sem cookie responde 401', async () => {
    const res = await a.t.app.inject({ method: 'GET', url: '/v1/jobs' });
    expect(res.statusCode).toBe(401);
  });
});
