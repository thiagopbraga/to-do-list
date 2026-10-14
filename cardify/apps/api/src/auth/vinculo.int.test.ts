import { anonSessions, documents, eq, jobs, quotaPeriods, users } from '@cardify/db';
import { inserirJobDireto } from '../jobs/helpers-teste';
import { COOKIE_ANON, COOKIE_SESSAO } from './constantes';
import { caminhoDoLink, Cookies, criarAppAuth, type AppAuth } from './helpers-teste';

describe('vínculo do trabalho anônimo no login', () => {
  let a: AppAuth;

  beforeAll(async () => {
    a = await criarAppAuth();
  });
  afterAll(() => a.t.fechar());
  beforeEach(async () => {
    await a.t.banco.limpar();
    a.email.mensagens.length = 0;
  });

  const abrirAnonimo = async () => {
    const cookies = new Cookies().absorver(await a.t.app.inject({ method: 'POST', url: '/v1/sessao/anonima' }));
    const [sessao] = await a.t.banco.db.select().from(anonSessions);
    return { cookies, anonId: sessao.id };
  };
  const loginPorEmail = async (cookies: Cookies, email = 'ana@exemplo.com') => {
    await a.t.app.inject({ method: 'POST', url: '/v1/auth/email', payload: { email } });
    return a.t.app.inject({ method: 'GET', url: caminhoDoLink(a.email), headers: cookies.header });
  };
  const obterJob = (cookies: Cookies, id: string) =>
    a.t.app.inject({ method: 'GET', url: `/v1/jobs/${id}`, headers: cookies.header });

  it('documento e job da sessão anônima passam a ser do usuário, sem tocar na cota', async () => {
    const { cookies: anonimo, anonId } = await abrirAnonimo();
    const job = await inserirJobDireto(a.t, { anonSessionId: anonId }, { amostra: true, cardsReservados: 0 });
    expect((await obterJob(anonimo, job.id)).statusCode).toBe(200);

    const res = await loginPorEmail(anonimo);
    expect(res.statusCode).toBe(302);

    const [usuarioId] = (await a.t.banco.db.select().from(anonSessions)).map((s) => s.userId);
    expect(usuarioId).toBeTruthy();
    const [doc] = await a.t.banco.db.select().from(documents);
    const [jobDepois] = await a.t.banco.db.select().from(jobs);
    expect(doc).toMatchObject({ userId: usuarioId, anonSessionId: null });
    expect(jobDepois).toMatchObject({ id: job.id, userId: usuarioId, anonSessionId: null, amostra: true, cardsReservados: 0 });
    expect(await a.t.banco.db.select().from(quotaPeriods)).toHaveLength(0);

    const logado = new Cookies().absorver(res);
    expect(logado.obter(COOKIE_ANON)).toBeUndefined();
    expect(res.cookies.find((c) => c.name === COOKIE_ANON)?.value).toBe('');
    const resposta = await obterJob(logado, job.id);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ id: job.id });
  });

  it('o cookie anônimo antigo deixa de dar acesso ao trabalho vinculado', async () => {
    const { cookies: anonimo, anonId } = await abrirAnonimo();
    const job = await inserirJobDireto(a.t, { anonSessionId: anonId });
    await loginPorEmail(anonimo);

    const res = await obterJob(anonimo, job.id);

    expect(res.statusCode).toBe(401);
  });

  it('não leva trabalho de outras sessões anônimas', async () => {
    const { cookies: anonimo } = await abrirAnonimo();
    const [outra] = await a.t.banco.db
      .insert(anonSessions)
      .values({ ipHash: 'outro', expiresAt: new Date(Date.now() + 86_400_000) })
      .returning();
    const jobDeOutra = await inserirJobDireto(a.t, { anonSessionId: outra.id });

    await loginPorEmail(anonimo);

    const [linha] = await a.t.banco.db.select().from(jobs).where(eq(jobs.id, jobDeOutra.id));
    expect(linha).toMatchObject({ userId: null, anonSessionId: outra.id });
  });

  it('sessão anônima expirada não é vinculada', async () => {
    const { cookies: anonimo, anonId } = await abrirAnonimo();
    const job = await inserirJobDireto(a.t, { anonSessionId: anonId });
    await a.t.banco.db.update(anonSessions).set({ expiresAt: new Date(Date.now() - 1000) });

    const res = await loginPorEmail(anonimo);

    expect(res.statusCode).toBe(302);
    expect(res.cookies.find((c) => c.name === COOKIE_SESSAO)).toBeDefined();
    const [linha] = await a.t.banco.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(linha).toMatchObject({ userId: null, anonSessionId: anonId });
  });

  it('cookie anônimo adulterado é ignorado no login', async () => {
    const { cookies: anonimo, anonId } = await abrirAnonimo();
    const job = await inserirJobDireto(a.t, { anonSessionId: anonId });
    const adulterado = new Cookies().definir(COOKIE_ANON, `${anonId}.assinatura-falsa`);

    await loginPorEmail(adulterado);

    const [linha] = await a.t.banco.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(linha).toMatchObject({ userId: null, anonSessionId: anonId });
    expect(anonimo.obter(COOKIE_ANON)).toBeDefined();
  });

  it('um cookie anônimo já vinculado não migra o trabalho para um segundo usuário', async () => {
    const { cookies: anonimo, anonId } = await abrirAnonimo();
    const job = await inserirJobDireto(a.t, { anonSessionId: anonId });
    await loginPorEmail(anonimo.copia(), 'ana@exemplo.com');

    await loginPorEmail(anonimo.copia(), 'bia@exemplo.com');

    const [ana] = await a.t.banco.db.select().from(users).where(eq(users.email, 'ana@exemplo.com'));
    const [linha] = await a.t.banco.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(linha.userId).toBe(ana.id);
  });
});
