import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { InfraModule } from './infra/infra.module';
import { SessaoModule } from './sessao/sessao.module';

@Module({
  imports: [InfraModule, SessaoModule],
  controllers: [HealthController],
})
export class AppModule {}
