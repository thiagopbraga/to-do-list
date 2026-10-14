import { custoCentavos, PRECOS_USD_POR_MILHAO } from './precos';

describe('custoCentavos', () => {
  it('haiku: 1M entrada + 1M saída = 0,60 USD = 324 centavos', () => {
    expect(custoCentavos('claude-haiku-5-5', 1_000_000, 1_000_000)).toBeCloseTo(324, 6);
  });

  it('sonnet: 100k entrada + 10k saída = 0,30 USD = 162 centavos', () => {
    expect(custoCentavos('claude-sonnet-5-5', 100_000, 10_000)).toBeCloseTo(162, 6);
  });

  it('opus: 1M entrada + 1M saída = 24 USD = 12960 centavos', () => {
    expect(custoCentavos('claude-opus-5-5', 1_000_000, 1_000_000)).toBeCloseTo(12_960, 6);
  });

  it('respeita usdBrl customizado', () => {
    expect(custoCentavos('claude-haiku-5-5', 1_000_000, 0, 6)).toBeCloseTo(60, 6);
  });

  it('modelos fake* custam zero', () => {
    expect(custoCentavos('fake-economico', 1_000_000, 1_000_000)).toBe(0);
    expect(custoCentavos('fake', 5, 5)).toBe(0);
  });

  it('modelo desconhecido usa o preço do sonnet', () => {
    expect(custoCentavos('modelo-novo', 1_000_000, 1_000_000)).toBe(custoCentavos('claude-sonnet-5-5', 1_000_000, 1_000_000));
  });

  it('exporta a tabela de preços', () => {
    expect(PRECOS_USD_POR_MILHAO['claude-opus-5-5']).toEqual({ entrada: 4, saida: 20 });
  });
});
