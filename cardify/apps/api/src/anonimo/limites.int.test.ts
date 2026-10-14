import { Logger } from '@nestjs/common';
import { anonGastoDiario, anonSessions, jobs } from '@cardify/db';
import { carregarEnv, LIMITES_ANONIMO } from '@cardify/shared';
import { ENV } from '../infra/tokens';
import { comoAnonimo, comoUsuario, criarUsuario, inserirJobDireto, PARAMETROS, textoDeEstudo } from '../jobs/helpers-teste';
import { criarAppTeste, type AppTeste } from '../testing/app-teste';
import { VERIFICADOR_TURNSTILE } from './tokens';
import type { VerificadorTurnstile } from './turnstile';

class VerificadorFake implements VerificadorTurnstile {
  readonly chamadas: Array<{ token: string; ip: string | undefined }> = [];
  async verificar(token: string, ip: string | undefined) {
    this.chamadas.push({ token, ip });
    return token === 'token-valido';
  }
}

const SITE_KEY = 'site-key-teste';
const envTeste = (extra: Record<string, string> = {}) =>
  carregarEnv({ NODE_ENV: 'test', TURNSTILE_SITE_KEY: SITE_KEY, TURNSTILE_SECRET: 'segredo', ANON_TETO_DIARIO_CENTAVOS: '100', ...extra });

async function sessaoAnonima(t: AppTeste, ipHash: string): Promise<string> {
  const [s] = await t.banco.db
    .insert(anonSessions)
    .values({ ipHash, expiresAt: new Date(Date.now() + 86_400_000) })
    .returning();
  return s.id;
}

const hoje = () => new Date().toISOString().slice(0, 10);

describe('limites do fluxo anônimo', () => {
  let t: AppTeste;
  let verificador: VerificadorFake;

  beforeAll(async () => {
    verificador = new VerificadorFake();
    t = await criarAppTeste((b) =>
      b.overrideProvider(ENV).useValue(envTeste()).overrideProvider(VERIFICADOR_TURNSTILE).useValue(verificador),
    );
  });
  afterAll(() => t.fechar());
  beforeEach(async () => {
    await t.banco.limpar();
    verificador.chamadas.length = 0;
  });

  let contador = 0;
  const postJob = (anonId: string, extra: Record<string, string> = {}, marca = `m${contador++}`) =>
    t.app.inject({
      method: 'POST',
      url: '/v1/jobs',
      headers: { ...comoAnonimo(anonId), ...extra },
      payload: { texto: textoDeEstudo(2, marca), parametros: PARAMETROS },
    });
  const estado = (headers: Record<string, string>) => t.app.inject({ method: 'GET', url: '/v1/anonimo/estado', headers });
  const todosJobs = () => t.banco.db.select().from(jobs);

  it('1ª geração passa sem Turnstile', async () => {
    const anon = await sessaoAnonima(t, 'ip-a');
    const res = await postJob(anon);
    expect(res.statusCode).toBe(202);
    expect(verificador.chamadas).toHaveLength(0);
  });

  it('2ª geração exige Turnstile e devolve a siteKey', async () => {
    const anon = await sessaoAnonima(t, 'ip-a');
    await postJob(anon);

    const res = await postJob(anon);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ erro: 'turnstile_necessario', siteKey: SITE_KEY });
    expect(await todosJobs()).toHaveLength(1);
  });

  it('2ª geração passa com token válido e repassa o IP ao verificador', async () => {
    const anon = await sessaoAnonima(t, 'ip-a');
    await postJob(anon);

    const res = await postJob(anon, { 'x-turnstile-token': 'token-valido' });
    expect(res.statusCode).toBe(202);
    expect(verificador.chamadas).toEqual([{ token: 'token-valido', ip: expect.any(String) }]);
    expect(await todosJobs()).toHaveLength(2);
  });

  it('2ª geração falha com token inválido', async () => {
    const anon = await sessaoAnonima(t, 'ip-a');
    await postJob(anon);

    const res = await postJob(anon, { 'x-turnstile-token': 'lixo' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ erro: 'turnstile_necessario', siteKey: SITE_KEY });
    expect(await todosJobs()).toHaveLength(1);
  });

  it('3ª geração do IP responde 429 mesmo com Turnstile válido', async () => {
    const anon = await sessaoAnonima(t, 'ip-a');
    await postJob(anon);
    await postJob(anon, { 'x-turnstile-token': 'token-valido' });

    const res = await postJob(anon, { 'x-turnstile-token': 'token-valido' });
    expect(res.statusCode).toBe(429);
    expect(res.json().erro).toBe('limite_diario_ip');
    expect(await todosJobs()).toHaveLength(LIMITES_ANONIMO.geracoesPorIpPorDia);
  });

  it('outra sessão anônima com o mesmo ip_hash herda a contagem; IP diferente não', async () => {
    const a1 = await sessaoAnonima(t, 'ip-a');
    const a2 = await sessaoAnonima(t, 'ip-a');
    const b = await sessaoAnonima(t, 'ip-b');
    await postJob(a1);

    const herdada = await postJob(a2);
    expect(herdada.statusCode).toBe(403);
    expect(herdada.json().erro).toBe('turnstile_necessario');
    expect((await postJob(a2, { 'x-turnstile-token': 'token-valido' })).statusCode).toBe(202);
    expect((await postJob(a1, { 'x-turnstile-token': 'token-valido' })).statusCode).toBe(429);

    expect((await postJob(b)).statusCode).toBe(202);
  });

  it('jobs de ontem não contam', async () => {
    const anon = await sessaoAnonima(t, 'ip-a');
    await inserirJobDireto(t, { anonSessionId: anon }, { createdAt: new Date(Date.now() - 2 * 86_400_000) });
    expect((await postJob(anon)).statusCode).toBe(202);
  });

  it('usuário logado nunca é limitado', async () => {
    const userId = await criarUsuario(t);
    for (let i = 0; i < LIMITES_ANONIMO.geracoesPorIpPorDia + 2; i++) {
      const res = await t.app.inject({
        method: 'POST',
        url: '/v1/jobs',
        headers: comoUsuario(userId),
        payload: { texto: textoDeEstudo(2, `u${i}`), parametros: PARAMETROS },
      });
      expect(res.statusCode).toBe(202);
    }
    await t.banco.db.insert(anonGastoDiario).values({ dia: hoje(), gastoCentavos: 10_000 });
    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/jobs',
      headers: comoUsuario(userId),
      payload: { texto: textoDeEstudo(2, 'depois-do-teto'), parametros: PARAMETROS },
    });
    expect(res.statusCode).toBe(202);
  });

  it('repetição idempotente com Idempotency-Key não é bloqueada', async () => {
    const anon = await sessaoAnonima(t, 'ip-a');
    const chave = { 'idempotency-key': 'req-1' };
    const primeira = await postJob(anon, chave, 'igual');
    await postJob(anon, { 'x-turnstile-token': 'token-valido' });

    const repetida = await postJob(anon, chave, 'igual');
    expect(repetida.statusCode).toBe(202);
    expect(repetida.json().id).toBe(primeira.json().id);
    expect(await todosJobs()).toHaveLength(2);
  });

  describe('teto global diário', () => {
    it('503 e alerta logado uma única vez por dia', async () => {
      const anon = await sessaoAnonima(t, 'ip-a');
      await t.banco.db.insert(anonGastoDiario).values({ dia: hoje(), gastoCentavos: 100 });
      const erro = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      try {
        const primeira = await postJob(anon);
        const segunda = await postJob(anon);
        for (const res of [primeira, segunda]) {
          expect(res.statusCode).toBe(503);
          expect(res.json()).toEqual({
            erro: 'amostra_indisponivel',
            mensagem: 'A geração gratuita está temporariamente indisponível. Entre para continuar.',
          });
        }
        const alertas = erro.mock.calls.filter(([msg]) => String(msg).includes('Teto diário de gasto anônimo'));
        expect(alertas).toHaveLength(1);
        expect(String(alertas[0][0])).toContain('100');
        expect(await todosJobs()).toHaveLength(0);
      } finally {
        erro.mockRestore();
      }
    });

    it('gasto de outro dia ou abaixo do teto não bloqueia', async () => {
      const anon = await sessaoAnonima(t, 'ip-a');
      await t.banco.db.insert(anonGastoDiario).values({ dia: '2020-01-01', gastoCentavos: 100_000 });
      await t.banco.db.insert(anonGastoDiario).values({ dia: hoje(), gastoCentavos: 99.5 });
      expect((await postJob(anon)).statusCode).toBe(202);
    });
  });

  describe('GET /v1/anonimo/estado', () => {
    it('reflete cada situação', async () => {
      const anon = await sessaoAnonima(t, 'ip-a');
      const outro = await sessaoAnonima(t, 'ip-a');
      const base = { limiteDiario: 2, siteKey: SITE_KEY };

      const res = await estado(comoAnonimo(anon));
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ...base, geracoesHoje: 0, exigeTurnstile: false, disponivel: true });

      await postJob(anon);
      expect((await estado(comoAnonimo(outro))).json()).toEqual({ ...base, geracoesHoje: 1, exigeTurnstile: true, disponivel: true });

      await postJob(anon, { 'x-turnstile-token': 'token-valido' });
      expect((await estado(comoAnonimo(anon))).json()).toEqual({ ...base, geracoesHoje: 2, exigeTurnstile: false, disponivel: false });

      await t.banco.limpar();
      const nova = await sessaoAnonima(t, 'ip-c');
      await t.banco.db.insert(anonGastoDiario).values({ dia: hoje(), gastoCentavos: 100 });
      expect((await estado(comoAnonimo(nova))).json()).toEqual({ ...base, geracoesHoje: 0, exigeTurnstile: false, disponivel: false });
    });

    it('usuário logado sempre disponível; sem sessão responde 401', async () => {
      const userId = await criarUsuario(t);
      const res = await estado(comoUsuario(userId));
      expect(res.json()).toMatchObject({ geracoesHoje: 0, exigeTurnstile: false, disponivel: true });
      expect((await estado({})).statusCode).toBe(401);
    });
  });
});

describe('Turnstile sem TURNSTILE_SECRET', () => {
  const abrir = (env: Record<string, string>) =>
    criarAppTeste((b) => b.overrideProvider(ENV).useValue(carregarEnv(env)).overrideProvider(VERIFICADOR_TURNSTILE).useValue(new VerificadorFake()));

  const cenario = async (t: AppTeste) => {
    await t.banco.limpar();
    const anon = await sessaoAnonima(t, 'ip-a');
    const post = (marca: string) =>
      t.app.inject({
        method: 'POST',
        url: '/v1/jobs',
        headers: comoAnonimo(anon),
        payload: { texto: textoDeEstudo(2, marca), parametros: PARAMETROS },
      });
    return post;
  };

  it('em production falha fechado a partir da 2ª geração', async () => {
    const t = await abrir({
      NODE_ENV: 'production',
      SESSION_SECRET: 'x'.repeat(40),
      S3_ACCESS_KEY_ID: 'chave',
      S3_SECRET_ACCESS_KEY: 'segredo',
      TURNSTILE_SITE_KEY: SITE_KEY,
    });
    try {
      const post = await cenario(t);
      expect((await post('1')).statusCode).toBe(202);
      const res = await post('2');
      expect(res.statusCode).toBe(403);
      expect(res.json().erro).toBe('turnstile_necessario');
    } finally {
      await t.fechar();
    }
  });

  it('em test/dev aceita sem token', async () => {
    const t = await abrir({ NODE_ENV: 'test' });
    try {
      const post = await cenario(t);
      expect((await post('1')).statusCode).toBe(202);
      expect((await post('2')).statusCode).toBe(202);
      expect((await post('3')).statusCode).toBe(429);
    } finally {
      await t.fechar();
    }
  });
});
