import type { FilaService, MetaJobFila, NomeFila, OpcoesEnvio } from '@cardify/shared';

/** FilaService em memória para testes da API: registra envios e deduplica por singletonKey. */
export class FilaEmMemoria implements FilaService {
  readonly enviados: Array<{ fila: NomeFila; payload: object; opcoes?: OpcoesEnvio }> = [];
  private readonly chaves = new Set<string>();

  async iniciar(): Promise<void> {}
  async parar(): Promise<void> {}

  async enviar<T extends object>(fila: NomeFila, payload: T, opcoes?: OpcoesEnvio): Promise<string | null> {
    if (opcoes?.singletonKey) {
      const chave = `${fila}:${opcoes.singletonKey}`;
      if (this.chaves.has(chave)) return null;
      this.chaves.add(chave);
    }
    this.enviados.push({ fila, payload, opcoes });
    return `fila-${this.enviados.length}`;
  }

  async processar<T extends object>(_fila: NomeFila, _handler: (payload: T, meta: MetaJobFila) => Promise<void>): Promise<void> {}
}
