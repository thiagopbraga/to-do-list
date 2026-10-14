import {
  Body,
  type ArgumentsHost,
  Catch,
  Controller,
  Delete,
  type ExceptionFilter,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  type RawBodyRequest,
  Req,
  UseFilters,
} from '@nestjs/common';
import { type Env, WebhookInvalidoError } from '@cardify/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodPipe } from '../comum/zod.pipe';
import { ENV } from '../infra/tokens';
import { type Dono, DonoAtual } from '../sessao/dono';
import { Publica } from '../sessao/sessao.guard';
import { AssinaturaService } from './assinatura.service';
import { FakePagamentoProvider } from './fake-pagamento.provider';
import { PagamentoFalhouError, type PagamentoProviderConsultavel } from './provider';
import { type AssinarComCpf, AssinarComCpfSchema, type SimularWebhook, SimularWebhookSchema } from './schemas';
import { PAGAMENTO_PROVIDER } from './tokens';
import { WebhookService } from './webhook.service';

@Catch(PagamentoFalhouError)
class PagamentoFalhouFilter implements ExceptionFilter {
  catch(erro: PagamentoFalhouError, host: ArgumentsHost) {
    void host
      .switchToHttp()
      .getResponse<FastifyReply>()
      .status(HttpStatus.BAD_GATEWAY)
      .send({ erro: erro.codigo, mensagem: erro.message });
  }
}

@Controller()
@UseFilters(PagamentoFalhouFilter)
export class PagamentoController {
  constructor(
    private readonly assinaturas: AssinaturaService,
    private readonly webhooks: WebhookService,
    @Inject(PAGAMENTO_PROVIDER) private readonly provider: PagamentoProviderConsultavel,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('assinatura')
  obter(@DonoAtual() dono: Dono) {
    return this.assinaturas.obter(dono.userId as string);
  }

  @Post('assinaturas')
  assinar(@DonoAtual() dono: Dono, @Body(new ZodPipe(AssinarComCpfSchema)) corpo: AssinarComCpf) {
    return this.assinaturas.assinar(dono.userId as string, corpo);
  }

  @Delete('assinatura')
  @HttpCode(204)
  async cancelar(@DonoAtual() dono: Dono): Promise<void> {
    await this.assinaturas.cancelar(dono.userId as string);
  }

  @Publica()
  @Post('webhooks/pagamento')
  @HttpCode(200)
  async webhook(@Req() requisicao: RawBodyRequest<FastifyRequest>) {
    // A assinatura é verificada sobre os bytes exatos recebidos; o JSON já parseado não serve.
    const rawBody = requisicao.rawBody;
    if (!rawBody) throw new WebhookInvalidoError('corpo bruto ausente');
    return this.tratar(rawBody, requisicao.headers);
  }

  @Publica()
  @Post('webhooks/pagamento/simular')
  @HttpCode(200)
  async simular(@Body(new ZodPipe(SimularWebhookSchema)) corpo: SimularWebhook) {
    const fake = this.provider;
    if (this.env.PAGAMENTO_PROVIDER !== 'fake' || this.env.NODE_ENV === 'production' || !(fake instanceof FakePagamentoProvider)) {
      throw new NotFoundException({ erro: 'nao_encontrado', mensagem: 'Recurso não encontrado.' });
    }
    const { rawBody, headers } = fake.gerarEvento(corpo.providerSubId, corpo.tipo);
    return this.tratar(rawBody, headers);
  }

  private async tratar(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    const evento = this.provider.interpretarWebhook(rawBody, headers);
    if (!evento) return { recebido: true, resultado: 'ignorado' };
    return { recebido: true, resultado: await this.webhooks.processar(evento, rawBody) };
  }
}
