import { naoImplementado } from '@cardify/shared';

export interface ResultadoDedup<T> {
  mantidos: T[];
  removidos: T[];
}

/** T09 — dedup por Jaccard sobre shingles de 3 tokens da frente normalizada (RFC §4.4). Mantém ordem original. */
export function deduplicarCards<T extends { frente: string; verso: string }>(_cards: T[], _limiar?: number): ResultadoDedup<T> {
  naoImplementado('T09');
}
