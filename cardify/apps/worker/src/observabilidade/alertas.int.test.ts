import { type Db, bancoDeTeste, documents, jobs, llmCalls, sql, users } from '@cardify/db';
import { PgBossFilaService } from '@cardify/queue';
import { carregarEnv, FILAS } from '@cardify/shared';
import { Test, type TestingModule } from '@nestjs/testing';
import { DB, ENV } from '../tokens';
import { AlertasService } from './alertas.service';

const AGORA = new Date('2026-10-14T12:00:00Z');
const MINUTO = 60 * 1000;
const URL_TESTE = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@localhost:5432/cardify_test';
const LIMITE_CENTAVOS = 100;

let banco: Awaited<ReturnType<typeof bancoDeTeste>>;
let db: Db;
let fila: PgBossFilaService;
let modulo: TestingModule;
let servico: AlertasService;
let erro: ReturnType<typeof vi.spyOn>;
let userId: string;
let documentId: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  db = banco.db;
  fila = new PgBossFilaService(URL_TESTE);
  await fila.iniciar();
});

afterAll(async () => {
  await fila.parar();
  await banco.fechar();
});

beforeEach(async () => {
  await banco.limpar();
  await db.execute(sql`DELETE FROM pgboss.job`);
  const [usuario] = await db.insert(users).values({ email: `alertas${Math.random()}@teste.com` }).returning();
  userId = usuario.id;
  const [documento] = await db
    .insert(documents)
    .values({
      userId,
      tipo: 'texto',
      sha256: 'c'.repeat(64),
      nome: 'material',
      storageKey: 'docs/alertas',
      status: 'processado',
      expiresAt: new Date(AGORA.getTime() + 86_400_000),
    })
    .returning();
  documentId = documento.id;

  const env = carregarEnv({ NODE_ENV: 'test', ALERTA_GASTO_DIARIO_CENTAVOS: String(LIMITE_CENTAVOS) });
  modulo = await Test.createTestingModule({
    providers: [AlertasService, { provide: ENV, useValue: env }, { provide: DB, useValue: db }],
  }).compile();
  await modulo.init();
  servico = modulo.get(AlertasService);
  erro = vi.spyOn(servico['log'], 'error');
});

afterEach(async () => {
  await modulo.close();
  vi.restoreAllMocks();
});

async function semearJob(opcoes: { status: 'concluido' | 'parcial' | 'falhou'; finalizadoEm: Date }) {
  await db.insert(jobs).values({
    userId,
    documentId,
    status: opcoes.status,
    params: { densidade: 'equilibrado', tipo: 'misto', area: 'geral' },
    paramsHash: 'h',
    orcamentoCentavos: 1000,
    erro: opcoes.status === 'falhou' ? 'falha' : null,
    createdAt: new Date(opcoes.finalizadoEm.getTime() - MINUTO),
    finishedAt: opcoes.finalizadoEm,
  });
}

async function semearGasto(custo: number, em: Date) {
  const [job] = await db
    .insert(jobs)
    .values({
      userId,
      documentId,
      status: 'concluido',
      params: { densidade: 'equilibrado', tipo: 'misto', area: 'geral' },
      paramsHash: 'h',
      orcamentoCentavos: 1000,
      createdAt: em,
    })
    .returning();
  await db.insert(llmCalls).values({
    jobId: job.id,
    estagio: 'formulacao',
    modelo: 'claude-haiku-5-5',
    tokensIn: 1,
    tokensOut: 1,
    custoCentavos: custo,
    latenciaMs: 1,
    createdAt: em,
  });
}

function alertasEmitidos(): string[] {
  return erro.mock.calls.map((chamada) => (chamada[0] as { alerta: string }).alerta);
}

describe('AlertasService: gasto diário', () => {
  it('dispara quando o gasto do dia UTC passa do limite', async () => {
    await semearGasto(60, AGORA);
    await semearGasto(60, AGORA);

    const emitidos = await servico.verificar(AGORA);

    expect(emitidos).toEqual(['gasto_diario']);
    expect(erro).toHaveBeenCalledWith(expect.objectContaining({ alerta: 'gasto_diario', gastoCentavos: 120, limiteCentavos: 100 }));
  });

  it('não dispara com gasto igual ao limite nem abaixo dele', async () => {
    await semearGasto(60, AGORA);
    await semearGasto(40, AGORA);
    expect(await servico.verificar(AGORA)).toEqual([]);

    await db.delete(llmCalls);
    await semearGasto(99, AGORA);
    expect(await servico.verificar(AGORA)).toEqual([]);
    expect(erro).not.toHaveBeenCalled();
  });

  it('ignora gasto de outros dias UTC', async () => {
    await semearGasto(500, new Date(AGORA.getTime() - 24 * 60 * MINUTO));
    await semearGasto(50, AGORA);

    expect(await servico.verificar(AGORA)).toEqual([]);
  });

  it('não repete o mesmo alerta dentro de 1 hora, mas volta a disparar depois', async () => {
    await semearGasto(200, AGORA);

    expect(await servico.verificar(AGORA)).toEqual(['gasto_diario']);
    expect(await servico.verificar(new Date(AGORA.getTime() + 30 * MINUTO))).toEqual([]);
    expect(await servico.verificar(new Date(AGORA.getTime() + 61 * MINUTO))).toEqual(['gasto_diario']);
    expect(alertasEmitidos()).toEqual(['gasto_diario', 'gasto_diario']);
  });
});

describe('AlertasService: fila gerar-baralho crescente', () => {
  it('dispara após 3 medições seguidas com profundidade crescente', async () => {
    await fila.enviar(FILAS.gerarBaralho, { jobId: 'a' });
    expect(await servico.verificar(AGORA)).toEqual([]);
    await fila.enviar(FILAS.gerarBaralho, { jobId: 'b' });
    expect(await servico.verificar(AGORA)).toEqual([]);
    await fila.enviar(FILAS.gerarBaralho, { jobId: 'c' });

    expect(await servico.verificar(AGORA)).toEqual(['fila_crescente']);
    expect(erro).toHaveBeenCalledWith(expect.objectContaining({ alerta: 'fila_crescente', medicoes: [1, 2, 3] }));
  });

  it('não dispara quando a profundidade para de crescer', async () => {
    await fila.enviar(FILAS.gerarBaralho, { jobId: 'a' });
    await servico.verificar(AGORA);
    await fila.enviar(FILAS.gerarBaralho, { jobId: 'b' });
    await servico.verificar(AGORA);
    await servico.verificar(AGORA);

    expect(await servico.verificar(AGORA)).toEqual([]);
    expect(erro).not.toHaveBeenCalled();
  });

  it('conta jobs em created e retry, e ignora os concluídos', async () => {
    const ids = [
      await fila.enviar(FILAS.gerarBaralho, { jobId: 'a' }),
      await fila.enviar(FILAS.gerarBaralho, { jobId: 'b' }),
      await fila.enviar(FILAS.gerarBaralho, { jobId: 'c' }),
    ];
    await db.execute(sql`UPDATE pgboss.job SET state = 'completed' WHERE id = ${ids[0]}`);
    await db.execute(sql`UPDATE pgboss.job SET state = 'retry' WHERE id = ${ids[1]}`);

    await servico.verificar(AGORA);

    expect(servico['profundidades']).toEqual([2]);
  });
});

describe('AlertasService: taxa de falha de jobs na última hora', () => {
  const finalizadoHaMinutos = (m: number) => new Date(AGORA.getTime() - m * MINUTO);

  it('dispara com mais de 5% de falhas e pelo menos 20 jobs', async () => {
    for (let i = 0; i < 18; i++) await semearJob({ status: 'concluido', finalizadoEm: finalizadoHaMinutos(10) });
    for (let i = 0; i < 2; i++) await semearJob({ status: 'falhou', finalizadoEm: finalizadoHaMinutos(10) });

    expect(await servico.verificar(AGORA)).toEqual(['falha_jobs']);
    expect(erro).toHaveBeenCalledWith(expect.objectContaining({ alerta: 'falha_jobs', falhas: 2, total: 20 }));
  });

  it('não dispara com exatamente 5% de falhas', async () => {
    for (let i = 0; i < 19; i++) await semearJob({ status: 'concluido', finalizadoEm: finalizadoHaMinutos(10) });
    await semearJob({ status: 'falhou', finalizadoEm: finalizadoHaMinutos(10) });

    expect(await servico.verificar(AGORA)).toEqual([]);
  });

  it('não dispara com menos de 20 jobs, mesmo com todos falhando', async () => {
    for (let i = 0; i < 19; i++) await semearJob({ status: 'falhou', finalizadoEm: finalizadoHaMinutos(10) });

    expect(await servico.verificar(AGORA)).toEqual([]);
  });

  it('ignora jobs finalizados há mais de 1 hora', async () => {
    for (let i = 0; i < 20; i++) await semearJob({ status: 'falhou', finalizadoEm: finalizadoHaMinutos(120) });
    for (let i = 0; i < 19; i++) await semearJob({ status: 'concluido', finalizadoEm: finalizadoHaMinutos(10) });
    await semearJob({ status: 'falhou', finalizadoEm: finalizadoHaMinutos(10) });

    expect(await servico.verificar(AGORA)).toEqual([]);
  });
});

describe('AlertasService: ciclo de vida', () => {
  it('não agenda verificação periódica em NODE_ENV=test', () => {
    expect(servico['intervalo']).toBeUndefined();
  });
});
