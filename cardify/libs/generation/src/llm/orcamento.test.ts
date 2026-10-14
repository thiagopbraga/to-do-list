import { OrcamentoEsgotadoError } from '@cardify/shared';
import { OrcamentoJob } from './orcamento';

describe('OrcamentoJob', () => {
  it('reserva soma ao gasto', () => {
    const o = new OrcamentoJob(10);
    o.reservar(3);
    o.reservar(2.5);
    expect(o.gastoCentavos).toBe(5.5);
  });

  it('lança ao passar do teto sem alterar o estado', () => {
    const o = new OrcamentoJob(10);
    o.reservar(8);
    expect(() => o.reservar(2.5)).toThrow(OrcamentoEsgotadoError);
    expect(o.gastoCentavos).toBe(8);
  });

  it('aceita exatamente o teto', () => {
    const o = new OrcamentoJob(10);
    o.reservar(10);
    expect(o.gastoCentavos).toBe(10);
  });

  it('ajustar troca a estimativa pelo real', () => {
    const o = new OrcamentoJob(10);
    o.reservar(6);
    o.ajustar(6, 2);
    expect(o.gastoCentavos).toBe(2);
    o.reservar(7);
    o.ajustar(7, 9);
    expect(o.gastoCentavos).toBe(11);
  });

  it('retoma de um gasto inicial', () => {
    const o = new OrcamentoJob(10, 9);
    expect(o.gastoCentavos).toBe(9);
    expect(() => o.reservar(2)).toThrow(OrcamentoEsgotadoError);
  });
});
