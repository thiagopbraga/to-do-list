import { naoImplementado, type ContextoChamadaLlm, type LedgerLlm, type LlmCliente, type LlmProvider, type LlmRequisicao, type LlmResposta } from '@cardify/shared';

/** T10 — único caminho de chamada de LLM: estimativa → orçamento → provider → ledger (RFC §4.5). */
export class LlmClienteRegistrado implements LlmCliente {
  constructor(
    readonly provider: LlmProvider,
    readonly ledger: LedgerLlm,
  ) {}
  async chamar(_ctx: ContextoChamadaLlm, _req: LlmRequisicao): Promise<LlmResposta> {
    naoImplementado('T10');
  }
}
