import type { CardRow } from '@cardify/db';
import type { CardTipo } from '@cardify/shared';

export interface ConteudoRegenerado {
  tipo: CardTipo;
  frente: string;
  verso: string;
  textoCloze: string | null;
}

/** Gera o conteúdo de um card novo a partir do antigo. */
export interface RegeneradorCards {
  regenerar(card: CardRow): Promise<ConteudoRegenerado>;
}

export const REGENERADOR = Symbol('REGENERADOR');

