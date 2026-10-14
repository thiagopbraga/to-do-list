import { Body, Controller, Get, HttpCode, Param, Post, Redirect } from '@nestjs/common';
import { CriarExportSchema, type CriarExport } from '@cardify/shared';
import { ZodPipe } from '../comum/zod.pipe';
import { DonoAtual, type Dono } from '../sessao/dono';
import { ExportacaoService } from './exportacao.service';

/** Exportação e download exigem usuário logado (sem @AceitaAnonimo). */
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportacao: ExportacaoService) {}

  @Post()
  @HttpCode(201)
  criar(@Body(new ZodPipe(CriarExportSchema)) corpo: CriarExport, @DonoAtual() dono: Dono) {
    return this.exportacao.criar(corpo, dono);
  }

  @Get(':id/download')
  @Redirect()
  async baixar(@Param('id') id: string, @DonoAtual() dono: Dono): Promise<{ url: string; statusCode: number }> {
    const url = await this.exportacao.urlDownload(id, dono);
    return { url, statusCode: 302 };
  }
}
