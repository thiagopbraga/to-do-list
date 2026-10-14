import { naoImplementado, type FilaService, type MetaJobFila, type NomeFila, type OpcoesEnvio } from '@cardify/shared';

/** T12 — FilaService sobre pg-boss (RFC §7.1). Schema próprio `pgboss`. */
export class PgBossFilaService implements FilaService {
  constructor(readonly connectionString: string) {}
  async iniciar(): Promise<void> {
    naoImplementado('T12');
  }
  async parar(): Promise<void> {
    naoImplementado('T12');
  }
  async enviar<T extends object>(_fila: NomeFila, _payload: T, _opcoes?: OpcoesEnvio): Promise<string | null> {
    naoImplementado('T12');
  }
  async processar<T extends object>(
    _fila: NomeFila,
    _handler: (payload: T, meta: MetaJobFila) => Promise<void>,
    _opcoes?: { concorrencia?: number },
  ): Promise<void> {
    naoImplementado('T12');
  }
}
