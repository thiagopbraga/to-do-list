import { Controller, Delete, HttpCode, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { type Dono, DonoAtual } from '../sessao/dono';
import { COOKIE_ANON, COOKIE_SESSAO } from './constantes';
import { limparCookies } from './cookies';
import { ContaService } from './conta.service';

@Controller('conta')
export class ContaController {
  constructor(private readonly conta: ContaService) {}

  @HttpCode(204)
  @Delete()
  async excluir(@DonoAtual() dono: Dono, @Res({ passthrough: true }) res: FastifyReply): Promise<void> {
    await this.conta.excluir(dono.userId as string);
    limparCookies(res, COOKIE_SESSAO, COOKIE_ANON);
  }
}
