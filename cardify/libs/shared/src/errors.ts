export class CardifyError extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = new.target.name;
  }
}

/** Orçamento de LLM do job esgotado: o job termina com sucesso parcial (RFC §4.5). */
export class OrcamentoEsgotadoError extends CardifyError {
  constructor(
    readonly tetoCentavos: number,
    readonly gastoCentavos: number,
  ) {
    super('orcamento_esgotado', `orçamento de ${tetoCentavos} centavos esgotado (gasto: ${gastoCentavos})`);
  }
}

export class CotaExcedidaError extends CardifyError {
  constructor(
    readonly limite: number,
    readonly solicitado: number,
  ) {
    super('cota_excedida', `cota excedida: limite ${limite}, solicitado ${solicitado}`);
  }
}

export type MotivoDocumentoInvalido =
  | 'tipo_invalido'
  | 'muito_grande'
  | 'paginas_demais'
  | 'escaneado'
  | 'timeout'
  | 'corrompido'
  | 'vazio';

export class DocumentoInvalidoError extends CardifyError {
  constructor(
    readonly motivo: MotivoDocumentoInvalido,
    mensagem: string,
  ) {
    super(`documento_${motivo}`, mensagem);
  }
}

export class WebhookInvalidoError extends CardifyError {
  constructor(mensagem = 'assinatura do webhook inválida') {
    super('webhook_invalido', mensagem);
  }
}

export class RespostaLlmInvalidaError extends CardifyError {
  constructor(
    mensagem: string,
    readonly textoBruto: string,
  ) {
    super('resposta_llm_invalida', mensagem);
  }
}
