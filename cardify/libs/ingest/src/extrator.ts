import { naoImplementado, type DocumentoExtraido, type OpcoesExtracao, type PdfExtractor } from '@cardify/shared';

/** T04 — extração com pdfjs-dist + agrupamento de linhas (RFC §3.2). */
export class PdfJsExtractor implements PdfExtractor {
  async extrair(_dados: Uint8Array, _opcoes?: OpcoesExtracao): Promise<DocumentoExtraido> {
    naoImplementado('T04');
  }
}
