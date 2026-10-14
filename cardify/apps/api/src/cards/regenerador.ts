import { ServiceUnavailableException } from '@nestjs/common';
import type { CardRow } from '@cardify/db';
import type { CardTipo } from '@cardify/shared';

export interface ConteudoRegenerado {
  tipo: CardTipo;
  frente: string;
  verso: string;
  textoCloze: string | null;
}

/** Gera o conteúdo de um card novo a partir do antigo (geração por LLM, outra task). */
export interface RegeneradorCards {
  regenerar(card: CardRow): Promise<ConteudoRegenerado>;
}

export const REGENERADOR = Symbol('REGENERADOR');

/** Provider padrão enquanto a geração por LLM não está ligada ao endpoint. */
export class RegeneradorIndisponivel implements RegeneradorCards {
  async regenerar(): Promise<ConteudoRegenerado> {
    throw new ServiceUnavailableException({ erro: 'regeneracao_indisponivel' });
  }
}
