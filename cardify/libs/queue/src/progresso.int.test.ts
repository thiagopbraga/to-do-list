import { randomUUID } from 'node:crypto';
import { CANAL_PROGRESSO, type ProgressoEvento } from '@cardify/shared';
import { Client } from 'pg';
import { PgProgressoPublisher, PgProgressoSubscriber } from './progresso';

const URL_BANCO = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@localhost:5432/cardify_test';

async function esperar(condicao: () => boolean, timeoutMs = 10_000): Promise<void> {
  const limite = Date.now() + timeoutMs;
  while (!condicao()) {
    if (Date.now() > limite) throw new Error('timeout aguardando condição');
    await new Promise((r) => setTimeout(r, 25));
  }
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

function evento(jobId: string, percentual: number, extra: Partial<ProgressoEvento> = {}): ProgressoEvento {
  return { jobId, status: 'gerando', estagio: 'geracao', percentual, cardsGerados: 0, ...extra };
}

describe('Progresso via LISTEN/NOTIFY', () => {
  let publisher: PgProgressoPublisher;
  let subscriber: PgProgressoSubscriber;
  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: URL_BANCO });
    await admin.connect();
  });

  beforeEach(() => {
    publisher = new PgProgressoPublisher(URL_BANCO);
    subscriber = new PgProgressoSubscriber(URL_BANCO, { atrasoBaseMs: 100 });
  });

  afterEach(async () => {
    await subscriber.fechar();
    await publisher.fechar();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('entrega a cada callback apenas os eventos do seu jobId', async () => {
    const [a, b] = [randomUUID(), randomUUID()];
    const recebidosA: ProgressoEvento[] = [];
    const recebidosB: ProgressoEvento[] = [];
    await subscriber.assinar(a, (e) => recebidosA.push(e));
    await subscriber.assinar(b, (e) => recebidosB.push(e));

    await publisher.publicar(evento(a, 10));
    await publisher.publicar(evento(b, 20));
    await publisher.publicar(evento(a, 30, { mensagem: 'oi' }));

    await esperar(() => recebidosA.length === 2 && recebidosB.length === 1);
    expect(recebidosA.map((e) => e.percentual)).toEqual([10, 30]);
    expect(recebidosA[1]?.mensagem).toBe('oi');
    expect(recebidosB.map((e) => e.percentual)).toEqual([20]);
  });

  it('para de receber após cancelar a assinatura', async () => {
    const jobId = randomUUID();
    const sentinela = randomUUID();
    const recebidos: number[] = [];
    let sentinelaVista = false;
    const cancelar = await subscriber.assinar(jobId, (e) => recebidos.push(e.percentual));
    await subscriber.assinar(sentinela, () => (sentinelaVista = true));

    await publisher.publicar(evento(jobId, 1));
    await esperar(() => recebidos.length === 1);
    await cancelar();
    await publisher.publicar(evento(jobId, 2));
    await publisher.publicar(evento(sentinela, 3));

    await esperar(() => sentinelaVista);
    expect(recebidos).toEqual([1]);
  });

  it('descarta payloads inválidos e segue entregando os válidos', async () => {
    const jobId = randomUUID();
    const recebidos: ProgressoEvento[] = [];
    await subscriber.assinar(jobId, (e) => recebidos.push(e));

    await admin.query('SELECT pg_notify($1, $2)', [CANAL_PROGRESSO, 'não é json']);
    await admin.query('SELECT pg_notify($1, $2)', [CANAL_PROGRESSO, JSON.stringify({ jobId, status: 'invalido' })]);
    await admin.query('SELECT pg_notify($1, $2)', [CANAL_PROGRESSO, JSON.stringify({ ...evento(jobId, 150) })]);
    await publisher.publicar(evento(jobId, 50));

    await esperar(() => recebidos.length > 0);
    await pausa(200);
    expect(recebidos.map((e) => e.percentual)).toEqual([50]);
  });

  it('rejeita evento inválido no publicar', async () => {
    await expect(publisher.publicar({ ...evento(randomUUID(), 10), percentual: 500 })).rejects.toThrow();
  });

  it('trunca mensagem que estoura o limite do NOTIFY', async () => {
    const jobId = randomUUID();
    const recebidos: ProgressoEvento[] = [];
    await subscriber.assinar(jobId, (e) => recebidos.push(e));

    const mensagem = 'ã'.repeat(9000);
    await publisher.publicar(evento(jobId, 40, { mensagem }));

    await esperar(() => recebidos.length === 1);
    const recebida = recebidos[0]?.mensagem ?? '';
    expect(recebida.length).toBeLessThan(mensagem.length);
    expect(recebida.endsWith('…')).toBe(true);
    expect(recebidos[0]?.percentual).toBe(40);
  });

  it('sobrevive à queda da conexão LISTEN e volta a receber', async () => {
    const jobId = randomUUID();
    const recebidos: number[] = [];
    await subscriber.assinar(jobId, (e) => recebidos.push(e.percentual));

    const pids = async () =>
      (
        await admin.query<{ pid: number }>(
          'SELECT pid FROM pg_stat_activity WHERE application_name = $1 AND pid <> pg_backend_pid()',
          [PgProgressoSubscriber.APPLICATION_NAME],
        )
      ).rows.map((r) => r.pid);

    const antes = await pids();
    expect(antes.length).toBeGreaterThan(0);
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = ANY($1::int[])', [antes]);

    const limite = Date.now() + 10_000;
    let depois: number[] = [];
    while (Date.now() < limite) {
      depois = await pids();
      if (depois.length > 0 && !antes.some((p) => depois.includes(p))) break;
      await pausa(100);
    }
    expect(depois.length).toBeGreaterThan(0);

    await publisher.publicar(evento(jobId, 77));
    await esperar(() => recebidos.length === 1);
    expect(recebidos).toEqual([77]);
  });
});
