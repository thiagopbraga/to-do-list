import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RESOLVEDOR_SESSAO } from '../infra/tokens';
import { ResolvedorSessaoCookies } from '../auth/resolvedor-cookies';
import { SessaoGuard } from './sessao.guard';

@Global()
@Module({
  providers: [
    { provide: RESOLVEDOR_SESSAO, useClass: ResolvedorSessaoCookies },
    { provide: APP_GUARD, useClass: SessaoGuard },
  ],
  exports: [RESOLVEDOR_SESSAO],
})
export class SessaoModule {}
