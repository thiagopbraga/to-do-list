import { naoImplementado, type ProgressoEvento, type ProgressoPublisher, type ProgressoSubscriber } from '@cardify/shared';

/** T12 — publica via NOTIFY no canal CANAL_PROGRESSO. */
export class PgProgressoPublisher implements ProgressoPublisher {
  constructor(readonly connectionString: string) {}
  async publicar(_evento: ProgressoEvento): Promise<void> {
    naoImplementado('T12');
  }
  async fechar(): Promise<void> {
    naoImplementado('T12');
  }
}

/** T12 — uma conexão LISTEN compartilhada, despacha por jobId. */
export class PgProgressoSubscriber implements ProgressoSubscriber {
  constructor(readonly connectionString: string) {}
  async assinar(_jobId: string, _aoReceber: (evento: ProgressoEvento) => void): Promise<() => Promise<void>> {
    naoImplementado('T12');
  }
  async fechar(): Promise<void> {
    naoImplementado('T12');
  }
}
