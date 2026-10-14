import { CARDS_POR_PARAGRAFO, type Densidade } from './schemas/job';

const CARACTERES_POR_PARAGRAFO = 600;

/** Para PDF antes da ingestão, o chamador passa `caracteres = paginas * 1800`. */
export function estimarCards({ caracteres, densidade }: { caracteres: number; densidade: Densidade }): number {
  const paragrafos = Math.ceil(Math.max(0, caracteres) / CARACTERES_POR_PARAGRAFO);
  return Math.max(1, paragrafos * CARDS_POR_PARAGRAFO[densidade]);
}
