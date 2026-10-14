import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { EditarCardSchema, type EditarCard } from '@cardify/shared';
import { ZodPipe } from '../comum/zod.pipe';
import { AceitaAnonimo } from '../sessao/sessao.guard';
import { DonoAtual, type Dono } from '../sessao/dono';
import { RevisaoService } from './revisao.service';
import { ListarCardsSchema, LoteCardsSchema, OrdemCardsSchema, type ListarCards, type LoteCards, type OrdemCards } from './schemas';

/** Revisão de cards (RF-05). Anônimo pode revisar o próprio job; o dono é conferido em cada rota. */
@Controller()
export class CardsController {
  constructor(private readonly revisao: RevisaoService) {}

  @AceitaAnonimo()
  @Get('jobs/:id/cards')
  listar(
    @Param('id') id: string,
    @Query(new ZodPipe(ListarCardsSchema)) consulta: ListarCards,
    @DonoAtual() dono: Dono,
  ) {
    return this.revisao.listar(id, dono, consulta);
  }

  @AceitaAnonimo()
  @Put('jobs/:id/cards/ordem')
  @HttpCode(204)
  async ordenar(
    @Param('id') id: string,
    @Body(new ZodPipe(OrdemCardsSchema)) corpo: OrdemCards,
    @DonoAtual() dono: Dono,
  ): Promise<void> {
    await this.revisao.ordenar(id, corpo, dono);
  }

  @AceitaAnonimo()
  @Patch('cards/:id')
  editar(
    @Param('id') id: string,
    @Body(new ZodPipe(EditarCardSchema)) corpo: EditarCard,
    @DonoAtual() dono: Dono,
  ) {
    return this.revisao.editar(id, corpo, dono);
  }

  @AceitaAnonimo()
  @Delete('cards/:id')
  @HttpCode(204)
  async descartar(@Param('id') id: string, @DonoAtual() dono: Dono): Promise<void> {
    await this.revisao.descartar(id, dono);
  }

  @AceitaAnonimo()
  @Post('cards/lote')
  @HttpCode(200)
  lote(@Body(new ZodPipe(LoteCardsSchema)) corpo: LoteCards, @DonoAtual() dono: Dono) {
    return this.revisao.lote(corpo, dono);
  }

  @AceitaAnonimo()
  @Post('cards/:id/regenerate')
  regenerar(@Param('id') id: string, @DonoAtual() dono: Dono) {
    return this.revisao.regenerar(id, dono);
  }
}
