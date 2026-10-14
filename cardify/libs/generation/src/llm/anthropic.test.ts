/* eslint-disable @typescript-eslint/no-explicit-any -- JSON de teste sem tipo */
import Anthropic from '@anthropic-ai/sdk';
import { CardifyError } from '@cardify/shared';
import { AnthropicLlmProvider } from './anthropic';

function montar(corpoResposta: object, status = 200) {
  const requisicoes: { url: string; body: any; headers: Headers }[] = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requisicoes.push({ url: String(url), body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return new Response(JSON.stringify(corpoResposta), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const cliente = new Anthropic({ apiKey: 'sk-teste', fetch: fakeFetch, maxRetries: 0 });
  return { provider: new AnthropicLlmProvider({ apiKey: 'sk-teste', cliente }), requisicoes };
}

const mensagem = (extra: object = {}) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: [
    { type: 'thinking', thinking: 'hmm', signature: 'sig' },
    { type: 'text', text: '{"a":' },
    { type: 'text', text: '1}' },
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 50, cache_read_input_tokens: 10 },
  ...extra,
});

const schema = { type: 'object', properties: { a: { type: 'number' } }, required: ['a'], additionalProperties: false };

describe('AnthropicLlmProvider', () => {
  it('monta a requisição e mapeia a resposta', async () => {
    const { provider, requisicoes } = montar(mensagem());
    const r = await provider.completar({
      tier: 'economico',
      sistema: 'sistema estável',
      mensagens: [{ papel: 'user', conteudo: 'oi' }],
      maxTokens: 321,
      temperatura: 0.7,
      jsonSchema: schema,
    });

    expect(requisicoes).toHaveLength(1);
    const { body, url, headers } = requisicoes[0]!;
    expect(url).toContain('/v1/messages');
    expect(headers.get('x-api-key')).toBe('sk-teste');
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.max_tokens).toBe(321);
    expect(body.system).toEqual([{ type: 'text', text: 'sistema estável', cache_control: { type: 'ephemeral' } }]);
    expect(body.messages).toEqual([{ role: 'user', content: 'oi' }]);
    expect(body.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema } });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
    expect(body).not.toHaveProperty('thinking');
    expect(body.stream).toBeFalsy();

    expect(r.texto).toBe('{"a":1}');
    expect(r.modelo).toBe('claude-haiku-5-5');
    expect(r.tokensIn).toBe(160);
    expect(r.tokensOut).toBe(20);
    expect(r.latenciaMs).toBeGreaterThanOrEqual(0);
  });

  it('tier forte usa sonnet e esforço medium; sem schema não envia format', async () => {
    const { provider, requisicoes } = montar(mensagem({ model: 'claude-sonnet-5-5', usage: { input_tokens: 5, output_tokens: 1 } }));
    const r = await provider.completar({ tier: 'forte', sistema: 's', mensagens: [{ papel: 'user', conteudo: 'a' }, { papel: 'assistant', conteudo: 'b' }], maxTokens: 10 });
    const body = requisicoes[0]!.body;
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.output_config).toEqual({ effort: 'medium' });
    expect(body.messages[1]).toEqual({ role: 'assistant', content: 'b' });
    expect(r.tokensIn).toBe(5);
  });

  it('modelos e esforços configuráveis', async () => {
    const requisicoes: any[] = [];
    const fakeFetch = (async (_u: unknown, init?: RequestInit) => {
      requisicoes.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(mensagem()), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const provider = new AnthropicLlmProvider({
      apiKey: 'k',
      cliente: new Anthropic({ apiKey: 'k', fetch: fakeFetch }),
      modeloEconomico: 'm-eco',
      esforcoEconomico: 'high',
    });
    await provider.completar({ tier: 'economico', sistema: 's', mensagens: [{ papel: 'user', conteudo: 'a' }], maxTokens: 1 });
    expect(requisicoes[0].model).toBe('m-eco');
    expect(requisicoes[0].output_config.effort).toBe('high');
  });

  it('refusal lança CardifyError llm_recusou', async () => {
    const { provider } = montar(mensagem({ stop_reason: 'refusal', content: [] }));
    const erro = await provider
      .completar({ tier: 'forte', sistema: 's', mensagens: [{ papel: 'user', conteudo: 'a' }], maxTokens: 10 })
      .catch((e) => e);
    expect(erro).toBeInstanceOf(CardifyError);
    expect(erro.codigo).toBe('llm_recusou');
  });

  it('max_tokens devolve o texto parcial', async () => {
    const { provider } = montar(mensagem({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"a":' }] }));
    const r = await provider.completar({ tier: 'forte', sistema: 's', mensagens: [{ papel: 'user', conteudo: 'a' }], maxTokens: 10 });
    expect(r.texto).toBe('{"a":');
  });

  it('erro HTTP do SDK propaga', async () => {
    const { provider } = montar({ type: 'error', error: { type: 'invalid_request_error', message: 'ruim' } }, 400);
    await expect(
      provider.completar({ tier: 'forte', sistema: 's', mensagens: [{ papel: 'user', conteudo: 'a' }], maxTokens: 10 }),
    ).rejects.toThrow(/400/);
  });
});
