import { randomUUID } from 'node:crypto';
import { FILAS } from '@cardify/shared';
import { Client } from 'pg';
import { PgBossFilaService } from './pgboss';

const URL_BANCO = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@localhost:5432/cardify_test';

async function esperar(condicao: () => boolean, timeoutMs = 15_000): Promise<void> {
  const limite = Date.now() + timeoutMs;
  while (!condicao()) {
    if (Date.now() > limite) throw new Error('timeout aguardando condição');
    await new Promise((r) => setTimeout(r, 50));
  }
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('PgBossFilaService', () => {
  let fila: PgBossFilaService;

  beforeAll(async () => {
    const admin = new Client({ connectionString: URL_BANCO });
    await admin.connect();
    await admin.query('DROP SCHEMA IF EXISTS pgboss CASCADE');
    await admin.end();
  });

  beforeEach(async () => {
    fila = new PgBossFilaService(URL_BANCO, { pollingIntervalSeconds: 0.5, timeoutParadaMs: 2000 });
    await fila.iniciar();
  });

  afterEach(async () => {
    await fila.parar();
  });

  it('envia e processa um job entregando payload e meta.id', async () => {
    const recebidos: Array<{ payload: { jobId: string }; id: string }> = [];
    await fila.processar<{ jobId: string }>(FILAS.gerarBaralho, async (payload, meta) => {
      recebidos.push({ payload, id: meta.id });
    });
    const jobId = randomUUID();
    const id = await fila.enviar(FILAS.gerarBaralho, { jobId });

    expect(id).toEqual(expect.any(String));
    await esperar(() => recebidos.length > 0);
    expect(recebidos).toEqual([{ payload: { jobId }, id }]);
  });

  it('deduplica por singletonKey enquanto o job está pendente (null) e executa só uma vez', async () => {
    const chave = randomUUID();
    const execucoes: string[] = [];

    const primeiro = await fila.enviar(FILAS.gerarBaralho, { jobId: 'a' }, { singletonKey: chave });
    const segundo = await fila.enviar(FILAS.gerarBaralho, { jobId: 'b' }, { singletonKey: chave });
    expect(primeiro).toEqual(expect.any(String));
    expect(segundo).toBeNull();

    await fila.processar<{ jobId: string }>(FILAS.gerarBaralho, async (p) => {
      execucoes.push(p.jobId);
    });
    await esperar(() => execucoes.length > 0);
    await pausa(1500);
    expect(execucoes).toEqual(['a']);
  });

  it('envios simultâneos com a mesma singletonKey criam um único job', async () => {
    const chave = randomUUID();
    const ids = await Promise.all(
      Array.from({ length: 8 }, (_, i) => fila.enviar(FILAS.gerarBaralho, { jobId: String(i) }, { singletonKey: chave })),
    );
    expect(ids.filter((id) => id !== null)).toHaveLength(1);

    const execucoes: string[] = [];
    await fila.processar<{ jobId: string }>(FILAS.gerarBaralho, async (p) => {
      execucoes.push(p.jobId);
    });
    await esperar(() => execucoes.length > 0);
    await pausa(1500);
    expect(execucoes).toHaveLength(1);
  });

  it('jobs sem singletonKey não se deduplicam entre si', async () => {
    const ids = await Promise.all([1, 2, 3].map(() => fila.enviar(FILAS.gerarExport, { exportId: randomUUID() })));
    expect(ids.every((id) => typeof id === 'string')).toBe(true);
    let n = 0;
    await fila.processar(FILAS.gerarExport, async () => {
      n++;
    });
    await esperar(() => n === 3);
  });

  it('deduplica por singletonKey também enquanto o primeiro job está ativo', async () => {
    const chave = randomUUID();
    let liberar!: () => void;
    const bloqueio = new Promise<void>((r) => (liberar = r));
    let iniciou = false;
    let execucoes = 0;
    await fila.processar(FILAS.gerarBaralho, async () => {
      execucoes++;
      iniciou = true;
      await bloqueio;
    });

    await fila.enviar(FILAS.gerarBaralho, { jobId: 'a' }, { singletonKey: chave });
    await esperar(() => iniciou);
    const durante = await fila.enviar(FILAS.gerarBaralho, { jobId: 'b' }, { singletonKey: chave });
    expect(durante).toBeNull();

    liberar();
    await pausa(1500);
    expect(execucoes).toBe(1);
  });

  it('reexecuta o job quando o handler lança (retry)', async () => {
    let tentativas = 0;
    let concluiu = false;
    await fila.processar(FILAS.gerarBaralho, async () => {
      tentativas++;
      if (tentativas === 1) throw new Error('falha proposital');
      concluiu = true;
    });
    await fila.enviar(FILAS.gerarBaralho, { jobId: randomUUID() }, { retryLimit: 2, retryBackoff: false, retryDelaySegundos: 1 });

    await esperar(() => concluiu, 20_000);
    await pausa(1500);
    expect(tentativas).toBe(2);
  }, 30_000);

  it('respeita a concorrência configurada', async () => {
    let ativos = 0;
    let picoAtivos = 0;
    let concluidos = 0;
    await fila.processar(
      FILAS.gerarExport,
      async () => {
        ativos++;
        picoAtivos = Math.max(picoAtivos, ativos);
        await pausa(1000);
        ativos--;
        concluidos++;
      },
      { concorrencia: 2 },
    );
    for (let i = 0; i < 4; i++) await fila.enviar(FILAS.gerarExport, { exportId: randomUUID() });

    await esperar(() => concluidos === 4, 20_000);
    expect(picoAtivos).toBe(2);
  }, 30_000);

  it('rejeita uso antes de iniciar()', async () => {
    const semInicio = new PgBossFilaService(URL_BANCO);
    await expect(semInicio.enviar(FILAS.gerarBaralho, {})).rejects.toThrow(/iniciar/);
  });
});
