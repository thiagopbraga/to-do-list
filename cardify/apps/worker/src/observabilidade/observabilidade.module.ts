import { Module } from '@nestjs/common';
import { carregarEnv } from '@cardify/shared';
import { LoggerModule } from 'nestjs-pino';
import { AlertasService } from './alertas.service';
import { criarOpcoesLogger } from './logger';

@Module({
  imports: [LoggerModule.forRootAsync({ useFactory: () => criarOpcoesLogger(carregarEnv()) })],
  providers: [AlertasService],
})
export class ObservabilidadeModule {}
