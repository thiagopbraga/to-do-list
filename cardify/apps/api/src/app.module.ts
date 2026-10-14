import { Module } from '@nestjs/common';
import { AnonimoModule } from './anonimo/anonimo.module';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { HealthController } from './health/health.controller';
import { InfraModule } from './infra/infra.module';
import { JobsModule } from './jobs/jobs.module';
import { PagamentoModule } from './pagamento/pagamento.module';
import { SessaoModule } from './sessao/sessao.module';

@Module({
  imports: [InfraModule, SessaoModule, AuthModule, AnonimoModule, JobsModule, CardsModule, PagamentoModule],
  controllers: [HealthController],
})
export class AppModule {}
