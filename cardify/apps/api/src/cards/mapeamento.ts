import type { CardRow } from '@cardify/db';
import type { CardRevisao, NotaExportavel } from '@cardify/shared';

export function paraCardRevisao(linha: CardRow): CardRevisao {
  return {
    id: linha.id,
    jobId: linha.jobId,
    chunkId: linha.chunkId,
    tipo: linha.tipo,
    frente: linha.frente,
    verso: linha.verso,
    textoCloze: linha.textoCloze,
    tags: linha.tags,
    trilhaTitulos: linha.trilhaTitulos,
    fonteOffset: linha.fonteOffset,
    estado: linha.estado,
    ordem: linha.ordem,
  };
}

export function paraNotaExportavel(linha: CardRow): NotaExportavel {
  return {
    id: linha.id,
    tipo: linha.tipo,
    frente: linha.frente,
    verso: linha.verso,
    textoCloze: linha.textoCloze,
    trilhaTitulos: linha.trilhaTitulos,
    tags: linha.tags,
    ordem: linha.ordem,
    atualizadoEm: linha.updatedAt,
  };
}

/** Nome do baralho = nome do documento sem a extensão; `Cardify` quando não sobra nada. */
export function nomeDoBaralho(nomeDocumento: string | null | undefined): string {
  const semExtensao = (nomeDocumento ?? '').replace(/\.[^./\\]+$/, '').trim();
  return semExtensao || 'Cardify';
}
