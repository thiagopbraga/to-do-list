import { carregarEnv } from '@cardify/shared';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | undefined;

/** Liga o OpenTelemetry só com `OTEL_EXPORTER_OTLP_ENDPOINT`. Deve rodar antes de qualquer módulo instrumentado ser carregado. */
export function iniciarTelemetria(servico: string): void {
  if (sdk || !carregarEnv().OTEL_EXPORTER_OTLP_ENDPOINT) return;

  sdk = new NodeSDK({
    serviceName: servico,
    instrumentations: [getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } })],
  });
  sdk.start();
  process.once('SIGTERM', () => {
    void sdk?.shutdown();
  });
}
