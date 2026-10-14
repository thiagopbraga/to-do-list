import { CotaExcedidaError } from '@cardify/shared';
import {
  type Db,
  bancoDeTeste,
  confirmarCota,
  consultarCota,
  documents,
  eq,
  jobs,
  liberarReserva,
  periodoAtual,
  planoVigente,
  quotaPeriods,
  reservarECriarJob,
  subscriptions,
  users,
} from './index';

let banco: Awaited<ReturnType<typeof bancoDeTeste>>;
let db: Db;
let userId: string;
let documentId: string;

const AGORA = new Date('2026-03-15T12:00:00Z');
const PARAMS = { densidade: 'equilibrado', tipo: 'misto', area: 'geral' } as const;

beforeAll(async () => {
  banco = await bancoDeTeste();
  db = banco.db;
});

afterAll(async () => {
  await banco.fechar();
});

beforeEach(async () => {
  await banco.limpar();
  const [usuario] = await db.insert(users).values({ email: 'ana@exemplo.com' }).returning();
  userId = usuario.id;
  const [documento] = await db
    .insert(documents)
    .values({
      userId,
      tipo: 'texto',
      sha256: 'a'.repeat(64),
      nome: 'resumo.txt',
      storageKey: 'docs/x/original',
      status: 'processado',
      expiresAt: new Date(Date.UTC(2030, 0, 1)),
    })
    .returning();
  documentId = documento.id;
});

function reservar(estimativa: number, agora: Date = AGORA) {
  return reservarECriarJob(db, {
    userId,
    estimativa,
    agora,
    criarJob: async (tx, reservado) => {
      const [job] = await tx
        .insert(jobs)
        .values({
          userId,
          documentId,
          status: 'pendente',
          params: PARAMS,
          paramsHash: 'h',
          orcamentoCentavos: 100,
          cardsReservados: reservado,
          createdAt: agora,
        })
        .returning({ id: jobs.id });
      return job;
    },
  });
}

async function periodos() {
  return db.select().from(quotaPeriods).where(eq(quotaPeriods.userId, userId));
}

async function reservaDoJob(jobId: string) {
  const [job] = await db.select({ cardsReservados: jobs.cardsReservados }).from(jobs).where(eq(jobs.id, jobId));
  return job.cardsReservados;
}

describe('reservarECriarJob', () => {
  it('cria o período do mês calendário UTC com limite do plano grátis', async () => {
    const r = await reservar(10);

    expect(r).toMatchObject({ reservado: 10, restante: 20 });
    const [periodo] = await periodos();
    expect(periodo.limiteCards).toBe(30);
    expect(periodo.periodoInicio).toEqual(new Date('2026-03-01T00:00:00Z'));
    expect(periodo.periodoFim).toEqual(new Date('2026-04-01T00:00:00Z'));
    expect(periodo.cardsReservados).toBe(10);
    expect(await reservaDoJob(r.jobId)).toBe(10);
  });

  it('serializa reservas concorrentes sem estourar o limite nem duplicar o período', async () => {
    const resultados = await Promise.allSettled(Array.from({ length: 10 }, () => reservar(5)));

    const ok = resultados.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const falhas = resultados.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
    const somaReservada = ok.reduce((soma, r) => soma + r.reservado, 0);

    expect(somaReservada).toBeLessThanOrEqual(30);
    expect(ok).toHaveLength(6);
    expect(falhas).toHaveLength(4);
    for (const falha of falhas) expect(falha).toBeInstanceOf(CotaExcedidaError);

    const lista = await periodos();
    expect(lista).toHaveLength(1);
    expect(lista[0].cardsReservados).toBe(somaReservada);
    const criados = await db.select().from(jobs).where(eq(jobs.userId, userId));
    expect(criados).toHaveLength(ok.length);
  });

  it('reserva parcial quando o restante é menor que a estimativa', async () => {
    await reservar(23);

    const r = await reservar(20);

    expect(r).toMatchObject({ reservado: 7, restante: 0 });
    expect(await reservaDoJob(r.jobId)).toBe(7);
    await expect(reservar(1)).rejects.toBeInstanceOf(CotaExcedidaError);
  });

  it('lança CotaExcedidaError com limite e solicitado', async () => {
    await reservar(30);

    await expect(reservar(4)).rejects.toMatchObject({ codigo: 'cota_excedida', limite: 30, solicitado: 4 });
  });

  it('desfaz a transação inteira quando criarJob lança', async () => {
    await expect(
      reservarECriarJob(db, {
        userId,
        estimativa: 10,
        agora: AGORA,
        criarJob: async () => {
          throw new Error('falha ao criar job');
        },
      }),
    ).rejects.toThrow('falha ao criar job');

    expect(await periodos()).toHaveLength(0);
    await reservar(10);
    const [periodo] = await periodos();
    expect(periodo.cardsReservados).toBe(10);
  });

  it('desfaz apenas a reserva quando o período já existia e criarJob lança', async () => {
    await reservar(10);

    await expect(
      reservarECriarJob(db, {
        userId,
        estimativa: 5,
        agora: AGORA,
        criarJob: async () => {
          throw new Error('falha');
        },
      }),
    ).rejects.toThrow('falha');

    const [periodo] = await periodos();
    expect(periodo.cardsReservados).toBe(10);
  });
});

describe('confirmarCota', () => {
  it('confirma menos cards que o reservado e libera o resto; é idempotente', async () => {
    const { jobId } = await reservar(20);

    await confirmarCota(db, jobId, 12);
    await confirmarCota(db, jobId, 12);
    await confirmarCota(db, jobId, 20);

    const [periodo] = await periodos();
    expect(periodo.cardsConfirmados).toBe(12);
    expect(periodo.cardsReservados).toBe(0);
    expect(await reservaDoJob(jobId)).toBe(0);
  });

  it('conta apenas o reservado quando o job gerou mais', async () => {
    const { jobId } = await reservar(10);

    await confirmarCota(db, jobId, 50);

    const [periodo] = await periodos();
    expect(periodo.cardsConfirmados).toBe(10);
    expect(periodo.cardsReservados).toBe(0);
  });

  it('mantém as reservas de outros jobs', async () => {
    const a = await reservar(10);
    await reservar(5);

    await confirmarCota(db, a.jobId, 8);

    const [periodo] = await periodos();
    expect(periodo.cardsConfirmados).toBe(8);
    expect(periodo.cardsReservados).toBe(5);
  });

  it('confirma no período em que o job foi criado, mesmo após a virada', async () => {
    const { jobId } = await reservar(10, new Date('2026-03-31T23:00:00Z'));
    await reservar(4, new Date('2026-04-02T00:00:00Z'));

    await confirmarCota(db, jobId, 10);

    const lista = (await periodos()).sort((a, b) => a.periodoInicio.getTime() - b.periodoInicio.getTime());
    expect(lista.map((p) => [p.cardsConfirmados, p.cardsReservados])).toEqual([
      [10, 0],
      [0, 4],
    ]);
  });

  it('falha para job inexistente', async () => {
    await expect(confirmarCota(db, '00000000-0000-4000-8000-000000000000', 1)).rejects.toMatchObject({
      codigo: 'job_nao_encontrado',
    });
  });
});

describe('liberarReserva', () => {
  it('devolve toda a reserva sem confirmar nada; é idempotente', async () => {
    const { jobId } = await reservar(20);

    await liberarReserva(db, jobId);
    await liberarReserva(db, jobId);

    const [periodo] = await periodos();
    expect(periodo.cardsConfirmados).toBe(0);
    expect(periodo.cardsReservados).toBe(0);
    expect(await reservaDoJob(jobId)).toBe(0);
    expect((await consultarCota(db, userId, AGORA)).restante).toBe(30);
  });
});

describe('planos e períodos', () => {
  it('assinatura essencial ativa usa limite 1500 e o período da assinatura', async () => {
    await db.insert(subscriptions).values({
      userId,
      plano: 'essencial',
      status: 'ativa',
      periodoInicio: new Date('2026-03-10T08:00:00Z'),
      periodoFim: new Date('2026-04-10T08:00:00Z'),
    });

    await reservar(100);

    const [periodo] = await periodos();
    expect(periodo.limiteCards).toBe(1500);
    expect(periodo.periodoInicio).toEqual(new Date('2026-03-10T08:00:00Z'));
    expect(periodo.periodoFim).toEqual(new Date('2026-04-10T08:00:00Z'));
    expect(await planoVigente(db, userId, AGORA)).toBe('essencial');
  });

  it('assinatura expirada ou nunca paga cai para grátis', async () => {
    await db.insert(subscriptions).values([
      {
        userId,
        plano: 'essencial',
        status: 'ativa',
        periodoInicio: new Date('2026-01-10T00:00:00Z'),
        periodoFim: new Date('2026-02-10T00:00:00Z'),
      },
      {
        userId,
        plano: 'ilimitado',
        status: 'pendente',
        periodoInicio: null,
        periodoFim: null,
      },
    ]);

    expect(await planoVigente(db, userId, AGORA)).toBe('gratis');
    await reservar(5);
    const [periodo] = await periodos();
    expect(periodo.limiteCards).toBe(30);
  });

  it.each(['cancelada', 'atrasada'] as const)('assinatura %s mantém o plano até o fim do período pago', async (status) => {
    await db.insert(subscriptions).values({
      userId,
      plano: 'ilimitado',
      status,
      periodoInicio: new Date('2026-03-01T00:00:00Z'),
      periodoFim: new Date('2026-04-01T00:00:00Z'),
    });
    expect(await planoVigente(db, userId, AGORA)).toBe('ilimitado');
    expect(await planoVigente(db, userId, new Date('2026-04-02T00:00:00Z'))).toBe('gratis');
  });

  it('plano anual recorta o ano em períodos mensais a partir de periodo_inicio', async () => {
    await db.insert(subscriptions).values({
      userId,
      plano: 'anual',
      status: 'ativa',
      periodoInicio: new Date('2026-01-31T10:00:00Z'),
      periodoFim: new Date('2027-01-31T10:00:00Z'),
    });

    const janela = async (agora: Date) => {
      const p = await db.transaction((tx) => periodoAtual(tx, userId, agora));
      return [p.periodoInicio.toISOString(), p.periodoFim.toISOString(), p.limiteCards];
    };

    expect(await janela(new Date('2026-01-31T10:00:00Z'))).toEqual([
      '2026-01-31T10:00:00.000Z',
      '2026-02-28T10:00:00.000Z',
      1500,
    ]);
    expect(await janela(new Date('2026-03-15T00:00:00Z'))).toEqual([
      '2026-02-28T10:00:00.000Z',
      '2026-03-31T10:00:00.000Z',
      1500,
    ]);
    expect(await janela(new Date('2026-03-31T09:59:59Z'))).toEqual([
      '2026-02-28T10:00:00.000Z',
      '2026-03-31T10:00:00.000Z',
      1500,
    ]);
    expect(await janela(new Date('2027-01-15T00:00:00Z'))).toEqual([
      '2026-12-31T10:00:00.000Z',
      '2027-01-31T10:00:00.000Z',
      1500,
    ]);
    expect(await periodos()).toHaveLength(3);
  });
});

describe('consultarCota', () => {
  it('cria o período se não existir e reflete reservas e confirmações', async () => {
    const inicial = await consultarCota(db, userId, AGORA);
    expect(inicial).toEqual({
      plano: 'gratis',
      limite: 30,
      confirmados: 0,
      reservados: 0,
      restante: 30,
      periodoFim: new Date('2026-04-01T00:00:00Z'),
    });

    const a = await reservar(10);
    await reservar(5);
    await confirmarCota(db, a.jobId, 7);

    expect(await consultarCota(db, userId, AGORA)).toMatchObject({ confirmados: 7, reservados: 5, restante: 18 });
    expect(await periodos()).toHaveLength(1);
  });

  it('consultas concorrentes sem período não duplicam o período', async () => {
    await Promise.all(Array.from({ length: 5 }, () => consultarCota(db, userId, AGORA)));

    expect(await periodos()).toHaveLength(1);
  });
});
