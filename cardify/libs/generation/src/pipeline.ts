import { naoImplementado, type Card, type ChunkDocumento, type LlmCliente, type Orcamento, type ParametrosGeracao } from '@cardify/shared';

export interface ChunkPersistido extends ChunkDocumento {
  id: string;
}

export interface EntradaGeracao {
  jobId: string;
  chunks: ChunkPersistido[];
  parametros: ParametrosGeracao;
  orcamento: Orcamento;
  /** Para a amostra/anônimo: corta a geração ao atingir o limite. */
  limiteCards?: number;
}

export interface CardGerado extends Card {
  chunkId: string;
}

export interface ResultadoGeracao {
  cards: CardGerado[];
  parcial: boolean;
  motivoParcial?: 'orcamento' | 'limite_cards';
  chunksDescartados: number;
  reparosJson: number;
  clozeReprovados: number;
  duplicadosRemovidos: number;
}

export type AoProgredir = (chunksFeitos: number, chunksTotal: number, cardsAteAgora: number) => void | Promise<void>;

/** T15 — estágio A (fatos) + estágio B (cards) + validação de cloze + dedup (RFC §4). */
export async function gerarCards(_cliente: LlmCliente, _entrada: EntradaGeracao, _aoProgredir?: AoProgredir): Promise<ResultadoGeracao> {
  naoImplementado('T15');
}

/** T15 — gera um card substituto para o botão "regenerar este card". */
export async function regenerarCard(
  _cliente: LlmCliente,
  _ctx: { jobId: string; orcamento: Orcamento },
  _card: Card,
  _chunk: ChunkDocumento,
  _parametros: ParametrosGeracao,
): Promise<Card> {
  naoImplementado('T15');
}
