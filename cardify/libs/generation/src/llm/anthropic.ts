import { naoImplementado, type LlmProvider, type LlmRequisicao, type LlmResposta } from '@cardify/shared';

export interface ConfigAnthropic {
  apiKey: string;
  modeloEconomico?: string;
  modeloForte?: string;
}

/** T10 — provider real (Anthropic). */
export class AnthropicLlmProvider implements LlmProvider {
  constructor(readonly config: ConfigAnthropic) {}
  async completar(_req: LlmRequisicao): Promise<LlmResposta> {
    naoImplementado('T10');
  }
}
