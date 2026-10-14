import { Controller, Get } from '@nestjs/common';
import { LIMITES_ANONIMO } from '@cardify/shared';
import { type Dono, DonoAtual } from '../sessao/dono';
import { AceitaAnonimo } from '../sessao/sessao.guard';
import { AnonimoService, type EstadoAnonimo } from './anonimo.service';

@Controller('anonimo')
export class AnonimoController {
  constructor(private readonly anonimo: AnonimoService) {}

  /** Permite ao front decidir se mostra o widget Turnstile ou o convite para entrar. */
  @AceitaAnonimo()
  @Get('estado')
  estado(@DonoAtual() dono: Dono): Promise<EstadoAnonimo> | EstadoAnonimo {
    if (dono.userId || !dono.anonSessionId) {
      return {
        geracoesHoje: 0,
        limiteDiario: LIMITES_ANONIMO.geracoesPorIpPorDia,
        exigeTurnstile: false,
        siteKey: null,
        disponivel: true,
      };
    }
    return this.anonimo.estado(dono.anonSessionId);
  }
}
