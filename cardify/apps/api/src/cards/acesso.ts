import { NotFoundException } from '@nestjs/common';
import { type CardRow, type Db, type JobRow, cards, eq, jobs } from '@cardify/db';
import { mesmoDono, type Dono } from '../sessao/dono';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dono diferente e recurso inexistente recebem a mesma resposta, para não revelar que existem (RFC §8). */
export function naoEncontrado(): NotFoundException {
  return new NotFoundException({ erro: 'nao_encontrado' });
}

export function ehUuid(valor: string): boolean {
  return UUID.test(valor);
}

export async function jobDoDono(db: Db | Tx, jobId: string, dono: Dono): Promise<JobRow> {
  if (!ehUuid(jobId)) throw naoEncontrado();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job || !mesmoDono(dono, job)) throw naoEncontrado();
  return job;
}

export async function cardDoDono(db: Db | Tx, cardId: string, dono: Dono): Promise<{ card: CardRow; job: JobRow }> {
  if (!ehUuid(cardId)) throw naoEncontrado();
  const [linha] = await db
    .select({ card: cards, job: jobs })
    .from(cards)
    .innerJoin(jobs, eq(jobs.id, cards.jobId))
    .where(eq(cards.id, cardId));
  if (!linha || !mesmoDono(dono, linha.job)) throw naoEncontrado();
  return linha;
}
