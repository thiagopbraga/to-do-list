import { naoImplementado, type ResultadoIngestao } from '@cardify/shared';

export interface LimitesIngestao {
  maxBytes: number;
  maxPaginas: number;
  timeoutMs: number;
  /** Heap do processo filho, em MB. */
  maxMemoriaMb?: number;
}

/**
 * T07 — valida magic bytes, calcula SHA-256 e roda extração + limpeza + chunking
 * em processo filho isolado (RFC §3.1). Lança DocumentoInvalidoError.
 */
export async function ingerirPdfIsolado(_dados: Buffer, _limites: LimitesIngestao): Promise<ResultadoIngestao> {
  naoImplementado('T07');
}

/** T07 — texto colado: sem processo filho, só limites + chunkTexto. */
export function ingerirTexto(_texto: string, _maxCaracteres: number): ResultadoIngestao {
  naoImplementado('T07');
}

/** T07 — detecta o tipo real pelos magic bytes (file-type). */
export async function detectarTipo(_dados: Uint8Array): Promise<'pdf' | 'desconhecido'> {
  naoImplementado('T07');
}
