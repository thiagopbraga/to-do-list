import { OrcamentoEsgotadoError, type Orcamento } from '@cardify/shared';

/** Orçamento por job (RFC §4.5): gasto confirmado + reservas em aberto. */
export class OrcamentoJob implements Orcamento {
  private gasto: number;

  constructor(
    readonly tetoCentavos: number,
    gastoInicialCentavos = 0,
  ) {
    this.gasto = gastoInicialCentavos;
  }

  get gastoCentavos(): number {
    return this.gasto;
  }

  reservar(estimativaCentavos: number): void {
    if (this.gasto + estimativaCentavos > this.tetoCentavos) {
      throw new OrcamentoEsgotadoError(this.tetoCentavos, this.gasto);
    }
    this.gasto += estimativaCentavos;
  }

  ajustar(estimativaCentavos: number, realCentavos: number): void {
    this.gasto += realCentavos - estimativaCentavos;
  }
}
