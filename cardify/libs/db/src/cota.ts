import { CardifyError, CotaExcedidaError, PLANOS, type Plano } from '@cardify/shared';
import { and, desc, eq, gt, lte, sql } from 'drizzle-orm';
import type { Db } from './client';
import { type QuotaPeriodRow, jobs, quotaPeriods, subscriptions } from './schema';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executor = Db | Tx;

export interface CotaConsultada {
  plano: Plano;
  limite: number;
  confirmados: number;
  reservados: number;
  restante: number;
  periodoFim: Date;
}

function somarMesesUtc(data: Date, meses: number): Date {
  const alvo = new Date(
    Date.UTC(
      data.getUTCFullYear(),
      data.getUTCMonth() + meses,
      1,
      data.getUTCHours(),
      data.getUTCMinutes(),
      data.getUTCSeconds(),
      data.getUTCMilliseconds(),
    ),
  );
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(data.getUTCDate(), ultimoDia));
  return alvo;
}

async function assinaturaVigente(db: Executor, userId: string, agora: Date) {
  const [assinatura] = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'ativa'), gt(subscriptions.periodoFim, agora)),
    )
    .orderBy(desc(subscriptions.periodoFim))
    .limit(1);
  return assinatura;
}

export async function planoVigente(db: Executor, userId: string, agora: Date = new Date()): Promise<Plano> {
  return (await assinaturaVigente(db, userId, agora))?.plano ?? 'gratis';
}

async function calcularJanela(
  db: Executor,
  userId: string,
  agora: Date,
): Promise<{ plano: Plano; inicio: Date; fim: Date }> {
  const assinatura = await assinaturaVigente(db, userId, agora);
  if (!assinatura?.periodoFim) {
    const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    return { plano: 'gratis', inicio, fim: somarMesesUtc(inicio, 1) };
  }

  const fimAssinatura = assinatura.periodoFim;
  const inicioAssinatura = assinatura.periodoInicio ?? somarMesesUtc(fimAssinatura, -1);
  if (assinatura.plano !== 'anual') {
    return {
      plano: assinatura.plano,
      inicio: inicioAssinatura < agora ? inicioAssinatura : agora,
      fim: fimAssinatura,
    };
  }

  let k = Math.max(
    0,
    (agora.getUTCFullYear() - inicioAssinatura.getUTCFullYear()) * 12 +
      (agora.getUTCMonth() - inicioAssinatura.getUTCMonth()),
  );
  while (k > 0 && somarMesesUtc(inicioAssinatura, k) > agora) k--;
  while (somarMesesUtc(inicioAssinatura, k + 1) <= agora) k++;
  const fimMes = somarMesesUtc(inicioAssinatura, k + 1);
  return {
    plano: 'anual',
    inicio: somarMesesUtc(inicioAssinatura, k),
    fim: fimMes < fimAssinatura ? fimMes : fimAssinatura,
  };
}

async function buscarPeriodo(db: Executor, userId: string, agora: Date, travar: boolean) {
  const consulta = db
    .select()
    .from(quotaPeriods)
    .where(
      and(eq(quotaPeriods.userId, userId), lte(quotaPeriods.periodoInicio, agora), gt(quotaPeriods.periodoFim, agora)),
    )
    .orderBy(desc(quotaPeriods.periodoInicio))
    .limit(1);
  const [periodo] = await (travar ? consulta.for('update') : consulta);
  return periodo;
}

export async function periodoAtual(tx: Tx, userId: string, agora: Date): Promise<QuotaPeriodRow> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'cota:' + userId}, 0))`);
  const existente = await buscarPeriodo(tx, userId, agora, true);
  if (existente) return existente;

  const { plano, inicio, fim } = await calcularJanela(tx, userId, agora);
  const [criado] = await tx
    .insert(quotaPeriods)
    .values({ userId, periodoInicio: inicio, periodoFim: fim, limiteCards: PLANOS[plano].cotaCardsMes })
    .returning();
  return criado;
}

export async function reservarECriarJob(
  db: Db,
  params: {
    userId: string;
    estimativa: number;
    agora?: Date;
    criarJob: (tx: Tx, reservado: number) => Promise<{ id: string }>;
  },
): Promise<{ jobId: string; reservado: number; restante: number }> {
  const { userId, estimativa, agora = new Date(), criarJob } = params;
  return db.transaction(async (tx) => {
    const periodo = await periodoAtual(tx, userId, agora);
    const disponivel = periodo.limiteCards - periodo.cardsConfirmados - periodo.cardsReservados;
    if (disponivel <= 0) throw new CotaExcedidaError(periodo.limiteCards, estimativa);

    const reservado = Math.min(estimativa, disponivel);
    await tx
      .update(quotaPeriods)
      .set({ cardsReservados: sql`${quotaPeriods.cardsReservados} + ${reservado}` })
      .where(eq(quotaPeriods.id, periodo.id));
    const job = await criarJob(tx, reservado);
    return { jobId: job.id, reservado, restante: disponivel - reservado };
  });
}

async function encerrarReserva(db: Db, jobId: string, cardsReais: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, jobId)).for('update');
    if (!job) throw new CardifyError('job_nao_encontrado', `job ${jobId} não encontrado`);
    if (job.cardsReservados === 0 || !job.userId) return;

    const real = Math.max(0, Math.min(cardsReais, job.cardsReservados));
    const [periodo] = await tx
      .select()
      .from(quotaPeriods)
      .where(
        and(
          eq(quotaPeriods.userId, job.userId),
          lte(quotaPeriods.periodoInicio, job.createdAt),
          gt(quotaPeriods.periodoFim, job.createdAt),
        ),
      )
      .orderBy(desc(quotaPeriods.periodoInicio))
      .limit(1)
      .for('update');
    if (periodo) {
      await tx
        .update(quotaPeriods)
        .set({
          cardsReservados: sql`${quotaPeriods.cardsReservados} - ${job.cardsReservados}`,
          cardsConfirmados: sql`${quotaPeriods.cardsConfirmados} + ${real}`,
        })
        .where(eq(quotaPeriods.id, periodo.id));
    }
    await tx.update(jobs).set({ cardsReservados: 0 }).where(eq(jobs.id, jobId));
  });
}

export function confirmarCota(db: Db, jobId: string, cardsReais: number): Promise<void> {
  return encerrarReserva(db, jobId, cardsReais);
}

export function liberarReserva(db: Db, jobId: string): Promise<void> {
  return encerrarReserva(db, jobId, 0);
}

export async function consultarCota(db: Db, userId: string, agora: Date = new Date()): Promise<CotaConsultada> {
  const periodo =
    (await buscarPeriodo(db, userId, agora, false)) ??
    (await db.transaction((tx) => periodoAtual(tx, userId, agora)));
  return {
    plano: await planoVigente(db, userId, agora),
    limite: periodo.limiteCards,
    confirmados: periodo.cardsConfirmados,
    reservados: periodo.cardsReservados,
    restante: Math.max(0, periodo.limiteCards - periodo.cardsConfirmados - periodo.cardsReservados),
    periodoFim: periodo.periodoFim,
  };
}
