import { naoImplementado, type DocumentoExtraido } from '@cardify/shared';

export interface ResultadoLimpeza {
  documento: DocumentoExtraido;
  /** Textos (normalizados) identificados como ruído estrutural. */
  removidas: string[];
}

/** T05 — remove cabeçalho, rodapé, numeração e marca d'água repetidos (RFC §3.3). Função pura. */
export function limparRuidoEstrutural(_doc: DocumentoExtraido): ResultadoLimpeza {
  naoImplementado('T05');
}
