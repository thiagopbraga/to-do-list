import type { Env, LlmProvider, LlmTier } from '@cardify/shared';
import { AnthropicLlmProvider } from './anthropic';
import { FakeLlmProvider } from './fake';

type EnvLlm = Pick<Env, 'LLM_PROVIDER' | 'ANTHROPIC_API_KEY' | 'LLM_MODELO_ECONOMICO' | 'LLM_MODELO_FORTE'>;

export function criarLlmProvider(env: EnvLlm): LlmProvider {
  if (env.LLM_PROVIDER === 'fake') return new FakeLlmProvider();
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY é obrigatória quando LLM_PROVIDER=anthropic');
  return new AnthropicLlmProvider({
    apiKey: env.ANTHROPIC_API_KEY,
    modeloEconomico: env.LLM_MODELO_ECONOMICO,
    modeloForte: env.LLM_MODELO_FORTE,
  });
}

/** Modelo configurado por tier, para a estimativa de custo do `LlmClienteRegistrado`. */
export function modeloPorTier(env: Pick<Env, 'LLM_MODELO_ECONOMICO' | 'LLM_MODELO_FORTE'>): Record<LlmTier, string> {
  return { economico: env.LLM_MODELO_ECONOMICO, forte: env.LLM_MODELO_FORTE };
}
