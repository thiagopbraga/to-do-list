import { naoImplementado, type LlmProvider, type LlmRequisicao, type LlmResposta } from '@cardify/shared';

/** T10 — provider determinístico para testes e dev (LLM_PROVIDER=fake). */
export class FakeLlmProvider implements LlmProvider {
  async completar(_req: LlmRequisicao): Promise<LlmResposta> {
    naoImplementado('T10');
  }
}
