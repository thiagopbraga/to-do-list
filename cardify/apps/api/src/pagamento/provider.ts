import { CardifyError, type PagamentoProvider, type ResultadoAssinatura } from '@cardify/shared';

export type DadosPagamentoPendente = Pick<ResultadoAssinatura, 'urlPagamento' | 'pixCopiaECola' | 'pixQrCodeBase64'>;

/** Extensão local do contrato: `GET /assinatura` reapresenta a cobrança pendente sem guardá-la no banco. */
export interface PagamentoProviderConsultavel extends PagamentoProvider {
  consultarPagamentoPendente(providerSubId: string): Promise<DadosPagamentoPendente | null>;
}

/** Falha do provedor de pagamento (HTTP, rede ou resposta inesperada): a API responde 502. */
export class PagamentoFalhouError extends CardifyError {
  constructor(mensagem: string) {
    super('pagamento_falhou', mensagem);
  }
}
