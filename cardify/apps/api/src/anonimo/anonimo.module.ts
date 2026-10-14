import { Global, Module } from '@nestjs/common';
import type { Env } from '@cardify/shared';
import { ENV } from '../infra/tokens';
import { AnonimoController } from './anonimo.controller';
import { AnonimoService } from './anonimo.service';
import { LimiteAnonimoGuard } from './limite-anonimo.guard';
import { VERIFICADOR_TURNSTILE } from './tokens';
import { VerificadorTurnstileCloudflare } from './turnstile';

/**
 * T23 — limites do fluxo anônimo (IP, Turnstile, teto diário).
 * Global para que `@UseGuards(LimiteAnonimoGuard)` em outros módulos resolva as dependências do guard.
 */
@Global()
@Module({
  controllers: [AnonimoController],
  providers: [
    AnonimoService,
    LimiteAnonimoGuard,
    {
      provide: VERIFICADOR_TURNSTILE,
      inject: [ENV],
      useFactory: (env: Env) => new VerificadorTurnstileCloudflare(env.TURNSTILE_SECRET),
    },
  ],
  exports: [AnonimoService, LimiteAnonimoGuard, VERIFICADOR_TURNSTILE],
})
export class AnonimoModule {}
