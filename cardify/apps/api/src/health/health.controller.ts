import { Controller, Get } from '@nestjs/common';
import { Publica } from '../sessao/sessao.guard';

@Controller('health')
export class HealthController {
  @Publica()
  @Get()
  status() {
    return { ok: true };
  }
}
