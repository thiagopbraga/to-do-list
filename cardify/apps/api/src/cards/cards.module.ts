import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { ExportacaoService } from './exportacao.service';
import { ExportsController } from './exports.controller';
import { REGENERADOR } from './regenerador';
import { RegeneradorLlm } from './regenerador-llm';
import { RevisaoService } from './revisao.service';

/** T20 — revisão de cards e exportação. */
@Module({
  controllers: [CardsController, ExportsController],
  providers: [RevisaoService, ExportacaoService, { provide: REGENERADOR, useClass: RegeneradorLlm }],
})
export class CardsModule {}
