import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { carregarEnv } from '@cardify/shared';
import { LoggerModule } from 'nestjs-pino';
import { pinoHttp } from 'pino-http';
import { criarOpcoesPino } from './logger';
import { MetricasController } from './metricas.controller';
import { MetricasService } from './metricas.service';
import { identificarRequisicao, vincularLogger } from './request-log.middleware';

const TODAS_AS_ROTAS = { path: '{*path}', method: RequestMethod.ALL };

/**
 * O pino-http é aplicado aqui, e não pelo LoggerModule, para que `identificarRequisicao` rode antes dele
 * (o id da requisição precisa estar definido quando o pino-http cria o logger filho). O `exclude` desliga
 * o middleware do LoggerModule e o `forRoutes` evita o padrão `*` dele, que gera aviso de rota legada.
 * O LoggerModule continua fornecendo `Logger` e `PinoLogger`.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: () => ({
        pinoHttp: criarOpcoesPino(carregarEnv()),
        exclude: [TODAS_AS_ROTAS],
        forRoutes: [TODAS_AS_ROTAS],
      }),
    }),
  ],
  controllers: [MetricasController],
  providers: [MetricasService],
})
export class ObservabilidadeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    const registrador = pinoHttp(criarOpcoesPino(carregarEnv()));
    consumer.apply(identificarRequisicao, registrador, vincularLogger).forRoutes(TODAS_AS_ROTAS);
  }
}
