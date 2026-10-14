import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { ExportacaoService } from './exportacao.service';
import { ExportsController } from './exports.controller';
import { REGENERADOR, RegeneradorIndisponivel } from './regenerador';
import { RevisaoService } from './revisao.service';

/** T20 — revisão de cards e exportação. */
@Module({
  controllers: [CardsController, ExportsController],
  providers: [RevisaoService, ExportacaoService, { provide: REGENERADOR, useClass: RegeneradorIndisponivel }],
})
export class CardsModule {}
