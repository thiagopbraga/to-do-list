import { DEDUP_LIMIAR_JACCARD, semAcento } from '@cardify/shared';
import { STOPWORDS_PT } from './stopwords';

export interface ResultadoDedup<T> {
  mantidos: T[];
  removidos: T[];
}

/** T09 — dedup por Jaccard sobre shingles de 3 tokens da frente normalizada (RFC §4.4). Mantém ordem original. */
export function deduplicarCards<T extends { frente: string; verso: string }>(
  cards: T[],
  limiar = DEDUP_LIMIAR_JACCARD,
): ResultadoDedup<T> {
  const mantidos: { card: T; shingles: Set<string> }[] = [];
  const removidos: T[] = [];

  for (const card of cards) {
    const shingles = shinglesDaFrente(card.frente);
    const posicao = mantidos.findIndex((m) => jaccard(m.shingles, shingles) >= limiar);

    if (posicao === -1) {
      mantidos.push({ card, shingles });
      continue;
    }

    const existente = mantidos[posicao].card;
    if (card.verso.trim().length < existente.verso.trim().length) {
      mantidos[posicao] = { card, shingles };
      removidos.push(existente);
    } else {
      removidos.push(card);
    }
  }

  return { mantidos: mantidos.map((m) => m.card), removidos };
}

function tokensDaFrente(frente: string): string[] {
  return semAcento(frente)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t !== '' && !STOPWORDS_PT.has(t));
}

function shinglesDaFrente(frente: string): Set<string> {
  const tokens = tokensDaFrente(frente);
  if (tokens.length === 0) return new Set();
  if (tokens.length < 3) return new Set([tokens.join(' ')]);

  const shingles = new Set<string>();
  for (let i = 0; i + 3 <= tokens.length; i++) {
    shingles.add(tokens.slice(i, i + 3).join(' '));
  }
  return shingles;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [menor, maior] = a.size <= b.size ? [a, b] : [b, a];
  let intersecao = 0;
  for (const s of menor) {
    if (maior.has(s)) intersecao++;
  }
  return intersecao / (a.size + b.size - intersecao);
}
