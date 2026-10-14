import { dataSaoPaulo, somarMeses } from './datas';

describe('somarMeses', () => {
  it('preserva o dia e o horário', () => {
    expect(somarMeses(new Date('2026-10-14T12:34:56.789Z'), 1).toISOString()).toBe('2026-11-14T12:34:56.789Z');
    expect(somarMeses(new Date('2026-10-14T12:00:00Z'), 12).toISOString()).toBe('2027-10-14T12:00:00.000Z');
  });

  it('limita ao último dia do mês de destino e atravessa o fim do ano', () => {
    expect(somarMeses(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(somarMeses(new Date('2028-02-29T00:00:00Z'), 12).toISOString()).toBe('2029-02-28T00:00:00.000Z');
    expect(somarMeses(new Date('2026-12-15T00:00:00Z'), 1).toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });
});

describe('dataSaoPaulo', () => {
  it('usa o fuso de São Paulo, não UTC', () => {
    expect(dataSaoPaulo(new Date('2026-10-14T02:00:00Z'))).toBe('2026-10-13');
    expect(dataSaoPaulo(new Date('2026-10-14T03:00:00Z'))).toBe('2026-10-14');
  });
});
