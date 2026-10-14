export interface PrecoModelo {
  /** USD por milhão de tokens de entrada. */
  entrada: number;
  /** USD por milhão de tokens de saída. */
  saida: number;
}

export const PRECOS_USD_POR_MILHAO: Readonly<Record<string, PrecoModelo>> = {
  'claude-haiku-5-5': { entrada: 0.1, saida: 0.5 },
  'claude-sonnet-5-5': { entrada: 2, saida: 10 },
  'claude-opus-5-5': { entrada: 4, saida: 20 },
  fake: { entrada: 0, saida: 0 },
};

const PRECO_PADRAO = PRECOS_USD_POR_MILHAO['claude-sonnet-5-5']!;

function precoDe(modelo: string): PrecoModelo {
  if (modelo.startsWith('fake')) return PRECOS_USD_POR_MILHAO['fake']!;
  // Modelo desconhecido cai no preço do sonnet: errar para cima protege o orçamento.
  return PRECOS_USD_POR_MILHAO[modelo] ?? PRECO_PADRAO;
}

/** Custo em centavos de real (fração permitida) dado o modelo e tokens. */
export function custoCentavos(modelo: string, tokensIn: number, tokensOut: number, usdBrl = 5.4): number {
  const preco = precoDe(modelo);
  const usd = (tokensIn * preco.entrada + tokensOut * preco.saida) / 1_000_000;
  return usd * usdBrl * 100;
}
