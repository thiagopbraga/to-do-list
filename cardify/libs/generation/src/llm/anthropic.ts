import Anthropic from '@anthropic-ai/sdk';
import { CardifyError, type LlmProvider, type LlmRequisicao, type LlmResposta } from '@cardify/shared';

type Esforco = 'low' | 'medium' | 'high';

export interface ConfigAnthropic {
  apiKey: string;
  modeloEconomico?: string;
  modeloForte?: string;
  esforcoEconomico?: Esforco;
  esforcoForte?: Esforco;
  timeoutMs?: number;
  /** Client já construído (testes injetam um com `fetch` falso). */
  cliente?: Anthropic;
}

/** Provider real (Anthropic Messages API, sem streaming). */
export class AnthropicLlmProvider implements LlmProvider {
  private readonly client: Anthropic;
  private readonly modelos: Record<LlmRequisicao['tier'], string>;
  private readonly esforcos: Record<LlmRequisicao['tier'], Esforco>;

  constructor(readonly config: ConfigAnthropic) {
    this.client =
      config.cliente ?? new Anthropic({ apiKey: config.apiKey, timeout: config.timeoutMs ?? 120_000, maxRetries: 2 });
    this.modelos = {
      economico: config.modeloEconomico ?? 'claude-haiku-5-5',
      forte: config.modeloForte ?? 'claude-sonnet-5-5',
    };
    this.esforcos = {
      economico: config.esforcoEconomico ?? 'low',
      forte: config.esforcoForte ?? 'medium',
    };
  }

  async completar(req: LlmRequisicao): Promise<LlmResposta> {
    const inicio = Date.now();
    // `req.temperatura` é ignorada de propósito: amostragem não padrão retorna 400 nestes modelos; custo é controlado por `effort`.
    const resposta = await this.client.messages.create({
      model: this.modelos[req.tier],
      max_tokens: req.maxTokens,
      system: [{ type: 'text', text: req.sistema, cache_control: { type: 'ephemeral' } }],
      messages: req.mensagens.map((m) => ({ role: m.papel, content: m.conteudo })),
      output_config: {
        effort: this.esforcos[req.tier],
        ...(req.jsonSchema ? { format: { type: 'json_schema' as const, schema: req.jsonSchema } } : {}),
      },
    });

    if (resposta.stop_reason === 'refusal') {
      throw new CardifyError('llm_recusou', `o modelo ${resposta.model} recusou a solicitação`);
    }

    const texto = resposta.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    const uso = resposta.usage;
    return {
      texto,
      modelo: resposta.model,
      tokensIn: uso.input_tokens + (uso.cache_creation_input_tokens ?? 0) + (uso.cache_read_input_tokens ?? 0),
      tokensOut: uso.output_tokens,
      latenciaMs: Date.now() - inicio,
    };
  }
}
