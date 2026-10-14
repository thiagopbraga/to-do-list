import { naoImplementado, type ChunkDocumento, type DocumentoExtraido } from '@cardify/shared';

/** T06 — contagem de tokens com js-tiktoken. */
export function contarTokens(_texto: string): number {
  naoImplementado('T06');
}

/** T06 — chunking semântico por títulos inferidos do tamanho de fonte (RFC §3.4). */
export function chunkDocumento(_doc: DocumentoExtraido): ChunkDocumento[] {
  naoImplementado('T06');
}

/** T06 — fallback para texto colado / sem estrutura: quebra por parágrafo duplo. */
export function chunkTexto(_texto: string): ChunkDocumento[] {
  naoImplementado('T06');
}
