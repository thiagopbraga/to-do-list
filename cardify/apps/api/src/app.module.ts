import { Module } from '@nestjs/common';
import { CardsModule } from './cards/cards.module';
import { HealthController } from './health/health.controller';
import { InfraModule } from './infra/infra.module';
import { JobsModule } from './jobs/jobs.module';
import { SessaoModule } from './sessao/sessao.module';

@Module({
  imports: [InfraModule, SessaoModule, JobsModule, CardsModule],
  controllers: [HealthController],
})
export class AppModule {}
