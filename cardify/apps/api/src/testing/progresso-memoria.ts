import type { ProgressoEvento, ProgressoSubscriber } from '@cardify/shared';

/** ProgressoSubscriber em memória: `emitir` simula o NOTIFY do worker. */
export class ProgressoEmMemoria implements ProgressoSubscriber {
  private readonly ouvintes = new Map<string, Set<(e: ProgressoEvento) => void>>();

  async assinar(jobId: string, aoReceber: (evento: ProgressoEvento) => void): Promise<() => Promise<void>> {
    const conjunto = this.ouvintes.get(jobId) ?? new Set();
    conjunto.add(aoReceber);
    this.ouvintes.set(jobId, conjunto);
    return async () => {
      conjunto.delete(aoReceber);
    };
  }

  emitir(evento: ProgressoEvento): void {
    for (const ouvinte of this.ouvintes.get(evento.jobId) ?? []) ouvinte(evento);
  }

  async fechar(): Promise<void> {}
}
