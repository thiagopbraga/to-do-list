import { carregarEnv } from '@cardify/shared';
import { AnthropicLlmProvider } from './anthropic';
import { criarLlmProvider, modeloPorTier } from './fabrica';
import { FakeLlmProvider } from './fake';

describe('criarLlmProvider', () => {
  it('devolve o provider fake por padrão', () => {
    expect(criarLlmProvider(carregarEnv({ NODE_ENV: 'test' }))).toBeInstanceOf(FakeLlmProvider);
  });

  it('devolve o provider Anthropic com os modelos do env', () => {
    const env = carregarEnv({
      NODE_ENV: 'test',
      LLM_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'chave',
      LLM_MODELO_ECONOMICO: 'modelo-a',
      LLM_MODELO_FORTE: 'modelo-b',
    });
    const provider = criarLlmProvider(env);
    expect(provider).toBeInstanceOf(AnthropicLlmProvider);
    expect((provider as AnthropicLlmProvider).config).toMatchObject({
      apiKey: 'chave',
      modeloEconomico: 'modelo-a',
      modeloForte: 'modelo-b',
    });
  });

  it('exige a chave quando o provider é anthropic', () => {
    expect(() =>
      criarLlmProvider({
        LLM_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: undefined,
        LLM_MODELO_ECONOMICO: 'a',
        LLM_MODELO_FORTE: 'b',
      }),
    ).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe('modeloPorTier', () => {
  it('mapeia os tiers para os modelos do env', () => {
    const env = carregarEnv({ NODE_ENV: 'test', LLM_MODELO_ECONOMICO: 'x', LLM_MODELO_FORTE: 'y' });
    expect(modeloPorTier(env)).toEqual({ economico: 'x', forte: 'y' });
  });
});
