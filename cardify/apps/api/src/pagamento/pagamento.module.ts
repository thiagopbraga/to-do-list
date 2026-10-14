import { Module } from '@nestjs/common';
import type { Env } from '@cardify/shared';
import { ENV } from '../infra/tokens';
import { AssinaturaService } from './assinatura.service';
import { AsaasPagamentoProvider } from './asaas-pagamento.provider';
import { FakePagamentoProvider } from './fake-pagamento.provider';
import { PagamentoController } from './pagamento.controller';
import type { PagamentoProviderConsultavel } from './provider';
import { PAGAMENTO_PROVIDER } from './tokens';
import { WebhookService } from './webhook.service';

/** T22 — assinaturas (Asaas), webhook e planos. */
@Module({
  controllers: [PagamentoController],
  providers: [
    {
      provide: PAGAMENTO_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env): PagamentoProviderConsultavel =>
        env.PAGAMENTO_PROVIDER === 'asaas'
          ? new AsaasPagamentoProvider({
              baseUrl: env.ASAAS_BASE_URL,
              apiKey: env.ASAAS_API_KEY as string,
              webhookToken: env.ASAAS_WEBHOOK_TOKEN as string,
            })
          : new FakePagamentoProvider(env.SESSION_SECRET),
    },
    AssinaturaService,
    WebhookService,
  ],
  exports: [AssinaturaService],
})
export class PagamentoModule {}
