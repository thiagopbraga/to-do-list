import { createHash } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Db, JobRow } from '@cardify/db';
import type { JobResumo, ProgressoEvento } from '@cardify/shared';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function sha256Hex(dados: string | Uint8Array): string {
  return createHash('sha256').update(dados).digest('hex');
}

/** JSON com chaves ordenadas em todos os níveis: mesmo conteúdo, mesmo hash. */
export function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${jsonCanonico(v)}`);
    return `{${entradas.join(',')}}`;
  }
  return JSON.stringify(valor);
}

/** 404 e não 403: não revelar a existência de recursos de outros donos. */
export const naoEncontrado = () => new NotFoundException({ erro: 'nao_encontrado', mensagem: 'Recurso não encontrado.' });

export const conflito = (erro: string, mensagem: string) => new ConflictException({ erro, mensagem });

/** O driver pode vir embrulhado pelo drizzle (`cause`). */
export function violacaoUnica(erro: unknown): boolean {
  let atual = erro as { code?: string; cause?: unknown } | undefined;
  for (let i = 0; i < 4 && atual; i++) {
    if (atual.code === '23505') return true;
    atual = atual.cause as typeof atual;
  }
  return false;
}

export function paraResumo(job: JobRow): JobResumo {
  return {
    id: job.id,
    status: job.status,
    cardsGerados: job.cardsGerados,
    custoCentavos: Math.round(job.custoCentavos),
    erro: job.erro,
    nome: job.nome,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

const ESTAGIO_POR_STATUS = {
  ingerindo: 'ingestao',
  gerando: 'geracao',
  empacotando: 'empacotamento',
} as const;

/** Estado atual do job no formato dos eventos do worker (primeiro evento do SSE). */
export function paraEventoProgresso(job: JobRow): ProgressoEvento {
  const estagio =
    job.status === 'ingerindo' || job.status === 'gerando' || job.status === 'empacotando'
      ? ESTAGIO_POR_STATUS[job.status]
      : job.estagioConcluido;
  let percentual = 0;
  if (job.status === 'ingerindo') percentual = 5;
  else if (job.status === 'gerando') {
    const fracao = job.cardsReservados > 0 ? Math.min(1, job.cardsGerados / job.cardsReservados) : 0;
    percentual = 10 + Math.round(80 * fracao);
  } else if (job.status === 'empacotando') percentual = 95;
  else if (job.status === 'concluido' || job.status === 'parcial') percentual = 100;

  return {
    jobId: job.id,
    status: job.status,
    estagio,
    percentual,
    cardsGerados: job.cardsGerados,
    ...(job.erro ? { mensagem: job.erro } : {}),
  };
}
