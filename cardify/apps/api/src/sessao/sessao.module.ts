import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RESOLVEDOR_SESSAO } from '../infra/tokens';
import { ResolvedorSessaoPendente } from './resolvedor-pendente';
import { SessaoGuard } from './sessao.guard';

@Global()
@Module({
  providers: [
    { provide: RESOLVEDOR_SESSAO, useClass: ResolvedorSessaoPendente },
    { provide: APP_GUARD, useClass: SessaoGuard },
  ],
  exports: [RESOLVEDOR_SESSAO],
})
export class SessaoModule {}
