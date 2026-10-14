import { users } from '@cardify/db';
import { COOKIE_OAUTH_RETORNO, COOKIE_OAUTH_STATE, COOKIE_OAUTH_VERIFIER, COOKIE_SESSAO } from './constantes';
import { ClienteGoogleArctic, perfilDeClaims } from './cliente-google';
import { Cookies, criarAppAuth, type AppAuth } from './helpers-teste';

describe('login com Google', () => {
  let a: AppAuth;

  beforeAll(async () => {
    a = await criarAppAuth();
  });
  afterAll(() => a.t.fechar());
  beforeEach(async () => {
    await a.t.banco.limpar();
    a.google.trocas.length = 0;
    a.google.perfil = { sub: 'g-1', email: 'ana@exemplo.com', emailVerificado: true, nome: 'Ana Google' };
  });

  const iniciar = (retorno?: string) =>
    a.t.app.inject({ method: 'GET', url: '/v1/auth/google', query: retorno === undefined ? {} : { retorno } });
  const callback = (cookies: Cookies, query: Record<string, string>) =>
    a.t.app.inject({ method: 'GET', url: '/v1/auth/google/callback', query, headers: cookies.header });

  async function comecar(retorno?: string) {
    const res = await iniciar(retorno);
    return { res, cookies: new Cookies().absorver(res), inicio: a.google.ultimoInicio! };
  }

  it('redireciona ao Google guardando state, verifier e retorno em cookies assinados de 10 min', async () => {
    const { res, inicio } = await comecar('/revisar/1');

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(inicio.url.toString());
    for (const nome of [COOKIE_OAUTH_STATE, COOKIE_OAUTH_VERIFIER, COOKIE_OAUTH_RETORNO]) {
      const cookie = res.cookies.find((c) => c.name === nome);
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', maxAge: 600 });
      expect(cookie?.value).toContain('.');
    }
    expect(res.cookies.find((c) => c.name === COOKIE_OAUTH_STATE)?.value.startsWith(`${inicio.state}.`)).toBe(true);
  });

  it('sem GOOGLE_CLIENT_ID volta para o login com erro=google_indisponivel', async () => {
    const sem = await criarAppAuth({ google: false });
    try {
      const res = await sem.t.app.inject({ method: 'GET', url: '/v1/auth/google' });
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/\/entrar\?erro=google_indisponivel$/);
      const cb = await sem.t.app.inject({ method: 'GET', url: '/v1/auth/google/callback?code=x&state=y' });
      expect(cb.statusCode).toBe(302);
      expect(cb.headers.location).toMatch(/\/entrar\?erro=google_indisponivel$/);
    } finally {
      await sem.t.fechar();
    }
  });

  it('callback cria o usuário, abre a sessão e redireciona para o retorno', async () => {
    const { cookies, inicio } = await comecar('/revisar/1');

    const res = await callback(cookies, { code: 'codigo-1', state: inicio.state });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/revisar/1');
    expect(a.google.trocas).toEqual([{ codigo: 'codigo-1', codeVerifier: inicio.codeVerifier }]);
    const [usuario] = await a.t.banco.db.select().from(users);
    expect(usuario).toMatchObject({ email: 'ana@exemplo.com', googleSub: 'g-1', nome: 'Ana Google' });
    expect(usuario.emailVerificadoEm).not.toBeNull();

    cookies.absorver(res);
    expect(cookies.obter(COOKIE_SESSAO)).toBeDefined();
    expect(cookies.obter(COOKIE_OAUTH_STATE)).toBeUndefined();
    const me = await a.t.app.inject({ method: 'GET', url: '/v1/me', headers: cookies.header });
    expect(me.json().usuario).toMatchObject({ email: 'ana@exemplo.com', nome: 'Ana Google' });
  });

  it('vincula pelo e-mail a um usuário existente e grava o google_sub', async () => {
    const [existente] = await a.t.banco.db.insert(users).values({ email: 'ana@exemplo.com' }).returning();
    a.google.perfil = { sub: 'g-9', email: 'Ana@Exemplo.com', emailVerificado: true, nome: 'Ana' };
    const { cookies, inicio } = await comecar();

    const res = await callback(cookies, { code: 'c', state: inicio.state });

    expect(res.headers.location).toBe('http://localhost:3000/');
    const todos = await a.t.banco.db.select().from(users);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ id: existente.id, googleSub: 'g-9', nome: 'Ana' });
    expect(todos[0].emailVerificadoEm).not.toBeNull();

    const de_novo = await comecar();
    const segundo = await callback(de_novo.cookies, { code: 'c', state: de_novo.inicio.state });
    expect(segundo.headers.location).toBe('http://localhost:3000/');
    expect(await a.t.banco.db.select().from(users)).toHaveLength(1);
  });

  it('acha o usuário por google_sub mesmo que o e-mail do Google tenha mudado', async () => {
    const [existente] = await a.t.banco.db.insert(users).values({ email: 'antigo@exemplo.com', googleSub: 'g-1' }).returning();
    const { cookies, inicio } = await comecar();

    await callback(cookies, { code: 'c', state: inicio.state });

    const todos = await a.t.banco.db.select().from(users);
    expect(todos).toHaveLength(1);
    expect(todos[0].id).toBe(existente.id);
  });

  it('e-mail de usuário que já está ligado a outra conta Google é recusado', async () => {
    await a.t.banco.db.insert(users).values({ email: 'ana@exemplo.com', googleSub: 'outra-conta' });
    const { cookies, inicio } = await comecar();

    const res = await callback(cookies, { code: 'c', state: inicio.state });

    expect(res.headers.location).toBe('http://localhost:3000/entrar?erro=google_falhou');
    expect(res.cookies.find((c) => c.name === COOKIE_SESSAO)).toBeUndefined();
  });

  it('e-mail não verificado é recusado', async () => {
    a.google.perfil = { sub: 'g-1', email: 'ana@exemplo.com', emailVerificado: false, nome: null };
    const { cookies, inicio } = await comecar();

    const res = await callback(cookies, { code: 'c', state: inicio.state });

    expect(res.headers.location).toBe('http://localhost:3000/entrar?erro=google_falhou');
    expect(await a.t.banco.db.select().from(users)).toHaveLength(0);
  });

  it('state divergente, ausente ou cookies faltando vão para o erro sem trocar o código', async () => {
    const { cookies, inicio } = await comecar();
    const erro = 'http://localhost:3000/entrar?erro=google_falhou';

    expect((await callback(cookies, { code: 'c', state: 'outro' })).headers.location).toBe(erro);
    expect((await callback(cookies, { code: 'c' })).headers.location).toBe(erro);
    expect((await callback(cookies, { state: inicio.state })).headers.location).toBe(erro);
    expect((await callback(new Cookies(), { code: 'c', state: inicio.state })).headers.location).toBe(erro);

    const adulterado = cookies.copia();
    adulterado.definir(COOKIE_OAUTH_STATE, `${inicio.state}.assinatura-falsa`);
    expect((await callback(adulterado, { code: 'c', state: inicio.state })).headers.location).toBe(erro);
    expect(a.google.trocas).toHaveLength(0);
  });

  it('falha na troca do código vai para o erro', async () => {
    a.google.perfil = new Error('invalid_grant');
    const { cookies, inicio } = await comecar();

    const res = await callback(cookies, { code: 'c', state: inicio.state });

    expect(res.headers.location).toBe('http://localhost:3000/entrar?erro=google_falhou');
  });

  it.each(['//evil.com', 'https://evil.com'])('retorno malicioso %j cai em /', async (retorno) => {
    const { cookies, inicio } = await comecar(retorno);

    const res = await callback(cookies, { code: 'c', state: inicio.state });

    expect(res.headers.location).toBe('http://localhost:3000/');
  });

  it('o state é de uso único: o cookie é limpo mesmo no erro', async () => {
    const { cookies, inicio } = await comecar();
    const res = await callback(cookies, { code: 'c', state: 'errado' });
    cookies.absorver(res);

    expect(cookies.obter(COOKIE_OAUTH_STATE)).toBeUndefined();
    const repetido = await callback(cookies, { code: 'c', state: inicio.state });
    expect(repetido.headers.location).toContain('erro=google_falhou');
  });
});

describe('cliente Google (arctic)', () => {
  it('monta a URL com PKCE e os escopos openid email profile', async () => {
    const cliente = new ClienteGoogleArctic('client-id', 'segredo', 'http://localhost:4000/v1/auth/google/callback');

    const { url, state, codeVerifier } = await cliente.iniciar();

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:4000/v1/auth/google/callback');
  });

  it('extrai sub, email, email_verified e name dos claims', () => {
    expect(perfilDeClaims({ sub: 's', email: 'a@b.com', email_verified: true, name: ' Ana ' })).toEqual({
      sub: 's',
      email: 'a@b.com',
      emailVerificado: true,
      nome: 'Ana',
    });
    expect(perfilDeClaims({ sub: 's', email: 'a@b.com', email_verified: 'true' })).toMatchObject({
      emailVerificado: false,
      nome: null,
    });
    expect(() => perfilDeClaims({ email: 'a@b.com' })).toThrow();
  });
});

