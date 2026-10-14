import { cards, documents, eq, exportacoes, jobs, magicLinks, sessions, users } from '@cardify/db';
import { inserirJobDireto } from '../jobs/helpers-teste';
import { COOKIE_SESSAO } from './constantes';
import { caminhoDoLink, Cookies, criarAppAuth, type AppAuth } from './helpers-teste';

describe('sessão de usuário, saída e exclusão de conta', () => {
  let a: AppAuth;

  beforeAll(async () => {
    a = await criarAppAuth();
  });
  afterAll(() => a.t.fechar());
  beforeEach(async () => {
    await a.t.banco.limpar();
    a.email.mensagens.length = 0;
  });

  async function entrar(email: string): Promise<{ cookies: Cookies; userId: string }> {
    await a.t.app.inject({ method: 'POST', url: '/v1/auth/email', payload: { email } });
    const res = await a.t.app.inject({ method: 'GET', url: caminhoDoLink(a.email) });
    const [usuario] = await a.t.banco.db.select().from(users).where(eq(users.email, email));
    return { cookies: new Cookies().absorver(res), userId: usuario.id };
  }
  const me = (cookies: Cookies) => a.t.app.inject({ method: 'GET', url: '/v1/me', headers: cookies.header });

  it('POST /auth/sair apaga a sessão do banco e limpa os cookies', async () => {
    const { cookies } = await entrar('ana@exemplo.com');
    expect((await me(cookies)).json().usuario).not.toBeNull();

    const res = await a.t.app.inject({ method: 'POST', url: '/v1/auth/sair', headers: cookies.header });

    expect(res.statusCode).toBe(204);
    expect(await a.t.banco.db.select().from(sessions)).toHaveLength(0);
    expect(res.cookies.find((c) => c.name === COOKIE_SESSAO)?.value).toBe('');
    // o cookie roubado também deixa de valer
    expect((await me(cookies)).json()).toEqual({ usuario: null, anonimo: false });
    const protegida = await a.t.app.inject({ method: 'GET', url: '/v1/jobs', headers: cookies.header });
    expect(protegida.statusCode).toBe(401);
  });

  it('POST /auth/sair sem sessão também responde 204', async () => {
    expect((await a.t.app.inject({ method: 'POST', url: '/v1/auth/sair' })).statusCode).toBe(204);
  });

  it('a rota protegida responde 200 com o cookie de usuário e 401 sem ele', async () => {
    const { cookies } = await entrar('ana@exemplo.com');

    expect((await a.t.app.inject({ method: 'GET', url: '/v1/jobs', headers: cookies.header })).statusCode).toBe(200);
    expect((await a.t.app.inject({ method: 'GET', url: '/v1/jobs' })).statusCode).toBe(401);
    expect((await a.t.app.inject({ method: 'DELETE', url: '/v1/conta' })).statusCode).toBe(401);
  });

  it('DELETE /conta apaga usuário, documentos, jobs, cards e objetos do storage', async () => {
    const { cookies, userId } = await entrar('ana@exemplo.com');
    const outro = await entrar('bia@exemplo.com');

    const job = await inserirJobDireto(a.t, { userId });
    const [doc] = await a.t.banco.db.update(documents).set({ storageKey: 'docs/ana.pdf', textoExtraidoKey: 'texto/ana.txt' }).where(eq(documents.userId, userId)).returning();
    await a.t.banco.db.insert(cards).values({ jobId: job.id, tipo: 'basico', frente: 'f', verso: 'v', ordem: 0 });
    await a.t.banco.db.insert(exportacoes).values({ jobId: job.id, formato: 'apkg', status: 'pronto', storageKey: 'exports/ana.apkg' });
    await a.t.banco.db.insert(exportacoes).values({ jobId: job.id, formato: 'csv', status: 'pendente' });
    for (const chave of [doc.storageKey, doc.textoExtraidoKey as string, 'exports/ana.apkg']) {
      await a.t.storage.gravar(chave, Buffer.from('x'), 'application/octet-stream');
    }

    const jobBia = await inserirJobDireto(a.t, { userId: outro.userId });
    await a.t.banco.db.update(documents).set({ storageKey: 'docs/bia.pdf' }).where(eq(documents.userId, outro.userId));
    await a.t.storage.gravar('docs/bia.pdf', Buffer.from('y'), 'application/pdf');

    const res = await a.t.app.inject({ method: 'DELETE', url: '/v1/conta', headers: cookies.header });

    expect(res.statusCode).toBe(204);
    expect(res.cookies.find((c) => c.name === COOKIE_SESSAO)?.value).toBe('');
    expect(await a.t.banco.db.select().from(users).where(eq(users.id, userId))).toHaveLength(0);
    expect(await a.t.banco.db.select().from(documents).where(eq(documents.userId, userId))).toHaveLength(0);
    expect(await a.t.banco.db.select().from(jobs).where(eq(jobs.id, job.id))).toHaveLength(0);
    expect(await a.t.banco.db.select().from(cards)).toHaveLength(0);
    expect(await a.t.banco.db.select().from(exportacoes)).toHaveLength(0);
    expect(await a.t.banco.db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
    expect(await a.t.banco.db.select().from(magicLinks).where(eq(magicLinks.email, 'ana@exemplo.com'))).toHaveLength(0);
    expect(await a.t.storage.metadados('docs/ana.pdf')).toBeNull();
    expect(await a.t.storage.metadados('texto/ana.txt')).toBeNull();
    expect(await a.t.storage.metadados('exports/ana.apkg')).toBeNull();

    expect((await me(cookies)).json()).toEqual({ usuario: null, anonimo: false });
    expect(await a.t.storage.metadados('docs/bia.pdf')).not.toBeNull();
    expect(await a.t.banco.db.select().from(jobs).where(eq(jobs.id, jobBia.id))).toHaveLength(1);
    expect((await me(outro.cookies)).json().usuario).toMatchObject({ email: 'bia@exemplo.com' });
  });

  it('DELETE /conta conclui mesmo se o storage falhar ao apagar um objeto', async () => {
    const { cookies, userId } = await entrar('ana@exemplo.com');
    await inserirJobDireto(a.t, { userId });
    const original = a.t.storage.apagar.bind(a.t.storage);
    a.t.storage.apagar = async () => {
      throw new Error('storage fora do ar');
    };
    try {
      const res = await a.t.app.inject({ method: 'DELETE', url: '/v1/conta', headers: cookies.header });
      expect(res.statusCode).toBe(204);
    } finally {
      a.t.storage.apagar = original;
    }
    expect(await a.t.banco.db.select().from(users)).toHaveLength(0);
  });
});
