import { naoImplementado, type Orcamento } from '@cardify/shared';

/** T10 — orçamento por job (RFC §4.5). */
export class OrcamentoJob implements Orcamento {
  constructor(
    readonly tetoCentavos: number,
    gastoInicialCentavos = 0,
  ) {
    void gastoInicialCentavos;
  }
  get gastoCentavos(): number {
    return naoImplementado('T10');
  }
  reservar(_estimativaCentavos: number): void {
    naoImplementado('T10');
  }
  ajustar(_estimativaCentavos: number, _realCentavos: number): void {
    naoImplementado('T10');
  }
}
