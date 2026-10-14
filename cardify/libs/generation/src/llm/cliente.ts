import type {
  ContextoChamadaLlm,
  LedgerLlm,
  LlmCliente,
  LlmProvider,
  LlmRequisicao,
  LlmResposta,
  LlmTier,
} from '@cardify/shared';
import { custoCentavos } from './precos';

const CARACTERES_POR_TOKEN = 3.5;

const MODELO_POR_TIER_PADRAO: Record<LlmTier, string> = {
  economico: 'claude-haiku-5-5',
  forte: 'claude-sonnet-5-5',
};

export interface OpcoesLlmCliente {
  usdBrl?: number;
  /** Só para ESTIMAR o custo antes da chamada; o custo real usa o modelo que respondeu. */
  modeloPorTier?: Partial<Record<LlmTier, string>>;
}

/** Único caminho de chamada de LLM: estimativa → orçamento → provider → ledger (RFC §4.5). */
export class LlmClienteRegistrado implements LlmCliente {
  private readonly usdBrl: number | undefined;
  private readonly modeloPorTier: Record<LlmTier, string>;

  constructor(
    readonly provider: LlmProvider,
    readonly ledger: LedgerLlm,
    opcoes: OpcoesLlmCliente = {},
  ) {
    this.usdBrl = opcoes.usdBrl;
    this.modeloPorTier = { ...MODELO_POR_TIER_PADRAO, ...opcoes.modeloPorTier };
  }

  async chamar(ctx: ContextoChamadaLlm, req: LlmRequisicao): Promise<LlmResposta> {
    const caracteres = req.sistema.length + req.mensagens.reduce((soma, m) => soma + m.conteudo.length, 0);
    const tokensInEstimados = Math.ceil(caracteres / CARACTERES_POR_TOKEN);
    const estimativa = custoCentavos(this.modeloPorTier[req.tier], tokensInEstimados, req.maxTokens, this.usdBrl);

    ctx.orcamento.reservar(estimativa);

    let resposta: LlmResposta;
    try {
      resposta = await this.provider.completar(req);
    } catch (erro) {
      ctx.orcamento.ajustar(estimativa, 0);
      throw erro;
    }

    const real = custoCentavos(resposta.modelo, resposta.tokensIn, resposta.tokensOut, this.usdBrl);
    ctx.orcamento.ajustar(estimativa, real);
    await this.ledger.registrar({
      jobId: ctx.jobId,
      estagio: ctx.estagio,
      modelo: resposta.modelo,
      tokensIn: resposta.tokensIn,
      tokensOut: resposta.tokensOut,
      custoCentavos: real,
      latenciaMs: resposta.latenciaMs,
    });
    return resposta;
  }
}
