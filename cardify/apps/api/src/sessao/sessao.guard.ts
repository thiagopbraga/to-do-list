import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RESOLVEDOR_SESSAO } from '../infra/tokens';
import type { RequisicaoComDono, ResolvedorSessao } from './dono';

export const ROTA_PUBLICA = 'cardify:rota-publica';
export const ACEITA_ANONIMO = 'cardify:aceita-anonimo';

/** Rota sem sessão (health, webhooks, login). */
export const Publica = () => SetMetadata(ROTA_PUBLICA, true);
/** Rota que aceita sessão anônima além de usuário logado (fluxo de amostra, RFC §8.1). */
export const AceitaAnonimo = () => SetMetadata(ACEITA_ANONIMO, true);

/** Guard global: toda rota exige usuário logado, salvo @Publica() ou @AceitaAnonimo(). */
@Injectable()
export class SessaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RESOLVEDOR_SESSAO) private readonly resolvedor: ResolvedorSessao,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ROTA_PUBLICA, alvos)) return true;

    const requisicao = ctx.switchToHttp().getRequest<RequisicaoComDono>();
    const dono = await this.resolvedor.resolver(requisicao);
    if (!dono || (!dono.userId && !dono.anonSessionId)) throw new UnauthorizedException('sessao_ausente');
    if (!dono.userId && !this.reflector.getAllAndOverride<boolean>(ACEITA_ANONIMO, alvos)) {
      throw new UnauthorizedException('login_necessario');
    }
    requisicao.dono = dono;
    return true;
  }
}
