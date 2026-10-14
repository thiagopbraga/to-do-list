import { DocumentoInvalidoError } from '@cardify/shared';
import { chunkDocumento } from './chunking';
import { PdfJsExtractor } from './extrator';
import { limparRuidoEstrutural } from './limpeza';
import type { RespostaFilho } from './runner';

interface MensagemProcessar {
  dados: Uint8Array;
  maxPaginas: number;
}

async function processar({ dados, maxPaginas }: MensagemProcessar): Promise<RespostaFilho> {
  try {
    const extraido = await new PdfJsExtractor().extrair(dados, { maxPaginas });
    if (extraido.escaneado) {
      throw new DocumentoInvalidoError(
        'escaneado',
        'Este arquivo parece escaneado (sem camada de texto). O OCR ainda não está disponível.',
      );
    }
    const { documento } = limparRuidoEstrutural(extraido);
    const chunks = chunkDocumento(documento);
    if (documento.totalCaracteres === 0 || chunks.length === 0) {
      throw new DocumentoInvalidoError('vazio', 'Não encontramos texto aproveitável neste arquivo.');
    }
    return {
      ok: true,
      resultado: { paginas: documento.paginas.length, totalCaracteres: documento.totalCaracteres, chunks },
    };
  } catch (erro) {
    if (erro instanceof DocumentoInvalidoError) return { ok: false, motivo: erro.motivo, mensagem: erro.message };
    return {
      ok: false,
      motivo: 'corrompido',
      mensagem: `O arquivo não pôde ser lido: ${erro instanceof Error ? erro.message : String(erro)}`,
    };
  }
}

function responderEEncerrar(resposta: unknown): void {
  if (!process.send) process.exit(1);
  process.send(resposta, () => process.exit(0));
}

process.once('message', (mensagem: unknown) => {
  const corpo = (mensagem ?? {}) as Partial<MensagemProcessar> & { diagnostico?: boolean };
  if (corpo.diagnostico === true) {
    responderEEncerrar({ diagnostico: Object.keys(process.env) });
    return;
  }
  if (!(corpo.dados instanceof Uint8Array) || typeof corpo.maxPaginas !== 'number') {
    responderEEncerrar({ ok: false, motivo: 'corrompido', mensagem: 'Mensagem inválida para o processo de ingestão.' });
    return;
  }
  void processar({ dados: corpo.dados, maxPaginas: corpo.maxPaginas }).then(responderEEncerrar);
});

process.once('disconnect', () => process.exit(1));
