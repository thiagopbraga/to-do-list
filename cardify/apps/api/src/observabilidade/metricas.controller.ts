import { createHash, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import type { Env } from '@cardify/shared';
import { z } from 'zod';
import { ENV } from '../infra/tokens';
import { Publica } from '../sessao/sessao.guard';
import { MetricasService } from './metricas.service';

const DIAS_PADRAO = 7;
const DIAS = z.coerce.number().int().min(1).max(90).optional();

/** Compara os digests, não os tokens: o tempo não depende do tamanho do token enviado. */
function tokenIgual(recebido: string, esperado: string): boolean {
  const a = createHash('sha256').update(recebido).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

@Controller('admin')
export class MetricasController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly metricas: MetricasService,
  ) {}

  /** Sem `ADMIN_TOKEN` configurado a rota não existe (404), para não revelar que ela está ali. */
  @Publica()
  @Get('metricas')
  async obter(@Headers('x-admin-token') token: string | undefined, @Query('dias') dias: string | undefined) {
    const esperado = this.env.ADMIN_TOKEN;
    if (!esperado) throw new NotFoundException();
    if (!token) throw new UnauthorizedException('admin_token_ausente');
    if (!tokenIgual(token, esperado)) throw new ForbiddenException('admin_token_invalido');

    const lido = DIAS.safeParse(dias);
    if (!lido.success) throw new BadRequestException({ erro: 'requisicao_invalida', mensagem: 'dias deve ser inteiro entre 1 e 90' });
    return this.metricas.gerar(lido.data ?? DIAS_PADRAO);
  }
}
