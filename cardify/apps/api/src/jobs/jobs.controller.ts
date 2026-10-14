import { Body, Controller, Get, Headers, HttpCode, type MessageEvent, Param, Post, Sse } from '@nestjs/common';
import { type CriarJob, CriarJobSchema } from '@cardify/shared';
import type { Observable } from 'rxjs';
import { ZodPipe } from '../comum/zod.pipe';
import { type Dono, DonoAtual } from '../sessao/dono';
import { AceitaAnonimo } from '../sessao/sessao.guard';
import { JobsService } from './jobs.service';

@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @AceitaAnonimo()
  @HttpCode(202)
  @Post('jobs')
  criar(
    @DonoAtual() dono: Dono,
    @Body(new ZodPipe(CriarJobSchema)) corpo: CriarJob,
    @Headers('idempotency-key') chave?: string,
  ) {
    return this.jobs.criar(dono, corpo, chave?.trim() || undefined);
  }

  @Get('jobs')
  listar(@DonoAtual() dono: Dono) {
    return this.jobs.listar(dono.userId as string);
  }

  @AceitaAnonimo()
  @Get('jobs/:id')
  obter(@DonoAtual() dono: Dono, @Param('id') id: string) {
    return this.jobs.obter(dono, id);
  }

  @AceitaAnonimo()
  @Sse('jobs/:id/events')
  eventos(@DonoAtual() dono: Dono, @Param('id') id: string): Promise<Observable<MessageEvent>> {
    return this.jobs.streamProgresso(dono, id);
  }

  @Get('cota')
  cota(@DonoAtual() dono: Dono) {
    return this.jobs.cota(dono.userId as string);
  }
}
