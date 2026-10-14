import { type Db, cards, documents, exportacoes, jobs, llmCalls } from '@cardify/db';
import { carregarEnv } from '@cardify/shared';
import { ENV } from '../infra/tokens';
import { criarAppTeste, type AppTeste } from '../testing/app-teste';
import { criarUsuario } from '../cards/testing/semear';

const TOKEN = 'a'.repeat(32);
const TOKEN_ERRADO = 'b'.repeat(32);
const DIA = 24 * 60 * 60 * 1000;
const PARAMS = { densidade: 'equilibrado', tipo: 'misto', area: 'geral' } as const;

let t: AppTeste;
let semToken: AppTeste;
let db: Db;
let userId: string;
let agora: number;

interface JobSeed {
  tipo: 'pdf' | 'texto';
  status: 'concluido' | 'parcial' | 'falhou';
  amostra?: boolean;
  custo?: number;
  criadoHaDias?: number;
  duracaoSegundos?: number | null;
  erro?: string | null;
}

async function semearJob(seed: JobSeed): Promise<string> {
  const criadoEm = new Date(agora - (seed.criadoHaDias ?? 1) * DIA);
  const [documento] = await db
    .insert(documents)
    .values({
      userId,
      tipo: seed.tipo,
      sha256: Math.random().toString(16).slice(2).padEnd(64, '0'),
      nome: 'material',
      storageKey: `docs/${Math.random()}`,
      status: 'processado',
      expiresAt: new Date(agora + DIA),
    })
    .returning();
  const duracao = seed.duracaoSegundos === undefined ? 60 : seed.duracaoSegundos;
  const [job] = await db
    .insert(jobs)
    .values({
      userId,
      documentId: documento.id,
      status: seed.status,
      params: PARAMS,
      paramsHash: 'h',
      amostra: seed.amostra ?? false,
      orcamentoCentavos: 1000,
      custoCentavos: seed.custo ?? 0,
      erro: seed.erro ?? null,
      createdAt: criadoEm,
      finishedAt: duracao === null ? null : new Date(criadoEm.getTime() + duracao * 1000),
    })
    .returning();
  return job.id;
}

async function semearCards(jobId: string, estados: Array<'gerado' | 'editado' | 'descartado'>) {
  await db.insert(cards).values(
    estados.map((estado, ordem) => ({ jobId, tipo: 'basico' as const, frente: `P${ordem}`, verso: 'R', ordem, estado })),
  );
}

async function semearLlm(jobId: string, estagio: string, quantidade: number, valores: { tokensIn: number; tokensOut: number; custo: number; latencia: number; criadoHaDias?: number }) {
  await db.insert(llmCalls).values(
    Array.from({ length: quantidade }, () => ({
      jobId,
      estagio,
      modelo: 'claude-haiku-5-5',
      tokensIn: valores.tokensIn,
      tokensOut: valores.tokensOut,
      custoCentavos: valores.custo,
      latenciaMs: valores.latencia,
      createdAt: new Date(agora - (valores.criadoHaDias ?? 1) * DIA),
    })),
  );
}

beforeAll(async () => {
  t = await criarAppTeste((b) =>
    b.overrideProvider(ENV).useValue(carregarEnv({ NODE_ENV: 'test', ADMIN_TOKEN: TOKEN })),
  );
  semToken = await criarAppTeste();
  db = t.banco.db;
});

afterAll(async () => {
  await t.fechar();
  await semToken.fechar();
});

beforeEach(async () => {
  await t.banco.limpar();
  userId = await criarUsuario(db);
  agora = Date.now();
});

const GET = (url: string, headers: Record<string, string> = {}) => t.app.inject({ method: 'GET', url, headers });
const comToken = { 'x-admin-token': TOKEN };

/** Cenário fixo: todos os números abaixo foram calculados à mão. */
async function semearCenario() {
  // Custo por baralho: jobs não amostra concluídos/parciais na janela. Valores 10,20,30,40,100.
  for (const custo of [10, 20, 30, 40, 100]) {
    await semearJob({ tipo: 'pdf', status: 'concluido', custo });
  }
  // Fora do cálculo de custo: falha, amostra e fora da janela.
  await semearJob({ tipo: 'pdf', status: 'falhou', custo: 999, erro: 'Documento sem texto' });
  await semearJob({ tipo: 'pdf', status: 'parcial', amostra: true, custo: 500, duracaoSegundos: 5 });
  await semearJob({ tipo: 'pdf', status: 'concluido', custo: 700, criadoHaDias: 30 });

  // Tempo até o primeiro card: amostras concluídas, 10,20,30,40,100 s.
  for (const duracao of [10, 20, 30, 40, 100]) {
    await semearJob({ tipo: 'texto', status: 'concluido', amostra: true, duracaoSegundos: duracao });
  }
  await semearJob({ tipo: 'texto', status: 'parcial', amostra: true, duracaoSegundos: 500 });
  await semearJob({ tipo: 'texto', status: 'concluido', amostra: true, duracaoSegundos: null });

  // Descarte: só jobs com export. Com export: 10 cards, 2 descartados. Sem export: não conta.
  const comExport = await semearJob({ tipo: 'texto', status: 'concluido', duracaoSegundos: 60 });
  await semearCards(comExport, ['descartado', 'descartado', 'editado', 'editado', 'editado', 'gerado', 'gerado', 'gerado', 'gerado', 'gerado']);
  await db.insert(exportacoes).values({ jobId: comExport, formato: 'apkg', status: 'pronto' });
  const semExport = await semearJob({ tipo: 'texto', status: 'concluido', duracaoSegundos: 60 });
  await semearCards(semExport, Array.from({ length: 8 }, () => 'descartado' as const));

  // Falhas: pdf 2 de 7 finais; texto 2 de 11 finais. Erro antigo fora da janela.
  await semearJob({ tipo: 'pdf', status: 'falhou', erro: 'Documento sem texto', duracaoSegundos: null });
  await semearJob({ tipo: 'texto', status: 'falhou', erro: 'Falha ao processar. Tente novamente.', duracaoSegundos: null });
  await semearJob({ tipo: 'texto', status: 'falhou', erro: 'Falha ao processar. Tente novamente.', duracaoSegundos: null });
  await semearJob({ tipo: 'texto', status: 'falhou', erro: 'Erro antigo', criadoHaDias: 30, duracaoSegundos: null });

  // LLM: formulacao 10, reparo 2, reformulacao_cloze 1, extracao 4. Uma chamada antiga fora da janela.
  const llmJob = await semearJob({ tipo: 'texto', status: 'concluido' });
  await semearLlm(llmJob, 'extracao', 4, { tokensIn: 100, tokensOut: 50, custo: 1.5, latencia: 1000 });
  await semearLlm(llmJob, 'formulacao', 10, { tokensIn: 200, tokensOut: 100, custo: 2, latencia: 2000 });
  await semearLlm(llmJob, 'reparo', 2, { tokensIn: 50, tokensOut: 20, custo: 0.5, latencia: 500 });
  await semearLlm(llmJob, 'reformulacao_cloze', 1, { tokensIn: 80, tokensOut: 40, custo: 1, latencia: 800 });
  await semearLlm(llmJob, 'formulacao', 1, { tokensIn: 9999, tokensOut: 9999, custo: 999, latencia: 1, criadoHaDias: 30 });
}

describe('GET /v1/admin/metricas: acesso', () => {
  it('404 quando ADMIN_TOKEN não está configurado', async () => {
    const res = await semToken.app.inject({ method: 'GET', url: '/v1/admin/metricas', headers: comToken });
    expect(res.statusCode).toBe(404);
  });

  it('401 sem o header x-admin-token', async () => {
    expect((await GET('/v1/admin/metricas')).statusCode).toBe(401);
  });

  it('403 com token errado (mesmo tamanho e tamanho diferente)', async () => {
    expect((await GET('/v1/admin/metricas', { 'x-admin-token': TOKEN_ERRADO })).statusCode).toBe(403);
    expect((await GET('/v1/admin/metricas', { 'x-admin-token': 'curto' })).statusCode).toBe(403);
  });

  it('200 com o token certo, sem sessão de usuário', async () => {
    const res = await GET('/v1/admin/metricas', comToken);
    expect(res.statusCode).toBe(200);
  });

  it('400 quando dias está fora de 1..90', async () => {
    expect((await GET('/v1/admin/metricas?dias=0', comToken)).statusCode).toBe(400);
    expect((await GET('/v1/admin/metricas?dias=abc', comToken)).statusCode).toBe(400);
  });

  it('devolve x-request-id: o recebido quando válido, senão um UUID', async () => {
    const comId = await GET('/v1/admin/metricas', { ...comToken, 'x-request-id': 'req-abc-123' });
    expect(comId.headers['x-request-id']).toBe('req-abc-123');

    const semId = await GET('/v1/admin/metricas', comToken);
    expect(semId.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const invalido = await GET('/v1/admin/metricas', { ...comToken, 'x-request-id': 'com espaço e ; caracteres' });
    expect(invalido.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('GET /v1/admin/metricas: valores calculados à mão', () => {
  it('custo por baralho, tempo até o primeiro card e taxa de descarte', async () => {
    await semearCenario();
    const corpo = (await GET('/v1/admin/metricas?dias=7', comToken)).json();

    // Custo: 10,20,30,40,100 mais três jobs auxiliares de custo 0 (export, descarte e LLM), todos não amostra.
    // [0,0,0,10,20,30,40,100]: p50 = 10 + 0.5 * 10 = 15; p95 = 40 + 0.65 * 60 = 79.
    expect(corpo.custoPorBaralhoCentavos).toMatchObject({ amostras: 8, p50: 15 });
    expect(corpo.custoPorBaralhoCentavos.p95).toBeCloseTo(79, 6);
    // Tempo: [10,20,30,40,100] s dos jobs de amostra concluídos. p50 = 30; p95 = 40 + 0.8 * 60 = 88.
    expect(corpo.tempoAtePrimeiroCardSegundos).toMatchObject({ amostras: 5, p50: 30 });
    expect(corpo.tempoAtePrimeiroCardSegundos.p95).toBeCloseTo(88, 6);
    // Só o job com export: 2 descartados de 10 cards.
    expect(corpo.taxaDescarte).toMatchObject({ taxa: 0.2, descartados: 2, total: 10, jobs: 1, teto: 0.25 });
  });

  it('falhas por tipo, taxa de falha e top erros', async () => {
    await semearCenario();
    const corpo = (await GET('/v1/admin/metricas?dias=7', comToken)).json();

    // pdf: 5 concluídos + 1 falhou (custo 999) + 1 parcial de amostra + 1 falhou = 8 finais, 2 falhas.
    // texto: 5 amostras + 1 parcial + 1 amostra sem duração + 2 não amostra + 1 LLM + 2 falhas = 12 finais, 2 falhas.
    expect(corpo.falhasPorTipoDocumento).toEqual([
      { tipo: 'pdf', falhas: 2, total: 8, taxa: 0.25 },
      { tipo: 'texto', falhas: 2, total: 12, taxa: 2 / 12 },
    ]);
    // 4 falhas em 20 jobs finais.
    expect(corpo.taxaFalhaJobs).toBeCloseTo(4 / 20, 10);
    expect(corpo.topErros).toEqual([
      { tipo: 'pdf', mensagem: 'Documento sem texto', ocorrencias: 2 },
      { tipo: 'texto', mensagem: 'Falha ao processar. Tente novamente.', ocorrencias: 2 },
    ]);
  });

  it('taxas de reparo e de reprovação de cloze derivadas de llm_calls', async () => {
    await semearCenario();
    const corpo = (await GET('/v1/admin/metricas?dias=7', comToken)).json();

    // reparo 2 / formulacao 10; reformulacao_cloze 1 / formulacao 10.
    expect(corpo.taxaReparoJson).toBeCloseTo(0.2, 10);
    expect(corpo.taxaReprovacaoCloze).toBeCloseTo(0.1, 10);
  });

  it('tokens, custo e latência média por estágio (sem a chamada fora da janela)', async () => {
    await semearCenario();
    const corpo = (await GET('/v1/admin/metricas?dias=7', comToken)).json();

    expect(corpo.estagios).toEqual([
      { estagio: 'extracao', chamadas: 4, tokensIn: 400, tokensOut: 200, custoCentavos: 6, latenciaMediaMs: 1000 },
      { estagio: 'formulacao', chamadas: 10, tokensIn: 2000, tokensOut: 1000, custoCentavos: 20, latenciaMediaMs: 2000 },
      { estagio: 'reformulacao_cloze', chamadas: 1, tokensIn: 80, tokensOut: 40, custoCentavos: 1, latenciaMediaMs: 800 },
      { estagio: 'reparo', chamadas: 2, tokensIn: 100, tokensOut: 40, custoCentavos: 1, latenciaMediaMs: 500 },
    ]);
  });

  it('a janela `dias` inclui jobs mais antigos quando pedida', async () => {
    await semearCenario();
    const corpo = (await GET('/v1/admin/metricas?dias=60', comToken)).json();

    // Acrescenta o job de 700 de 30 dias: [0,0,0,10,20,30,40,100,700]. p50 = 20; p95 = 100 + 0.6 * 600 = 460.
    expect(corpo.custoPorBaralhoCentavos).toMatchObject({ amostras: 9, p50: 20 });
    expect(corpo.custoPorBaralhoCentavos.p95).toBeCloseTo(460, 6);
    expect(corpo.janelaDias).toBe(60);
  });

  it('sem dados, taxas são null e percentis são null (não NaN nem zero)', async () => {
    const corpo = (await GET('/v1/admin/metricas', comToken)).json();

    expect(corpo.janelaDias).toBe(7);
    expect(corpo.custoPorBaralhoCentavos).toEqual({ amostras: 0, p50: null, p95: null });
    expect(corpo.taxaDescarte.taxa).toBeNull();
    expect(corpo.taxaFalhaJobs).toBeNull();
    expect(corpo.taxaReparoJson).toBeNull();
  });
});
