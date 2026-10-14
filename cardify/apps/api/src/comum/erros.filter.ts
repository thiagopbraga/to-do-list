import { ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { CardifyError, CotaExcedidaError, DocumentoInvalidoError, WebhookInvalidoError } from '@cardify/shared';
import type { FastifyReply } from 'fastify';

const STATUS_POR_ERRO: Array<[new (...args: never[]) => CardifyError, number]> = [
  [CotaExcedidaError, HttpStatus.PAYMENT_REQUIRED],
  [DocumentoInvalidoError, HttpStatus.UNPROCESSABLE_ENTITY],
  [WebhookInvalidoError, HttpStatus.UNAUTHORIZED],
];

/** Erros de domínio viram respostas `{ erro: codigo, mensagem }` com status adequado. */
@Catch(CardifyError)
export class ErrosDominioFilter implements ExceptionFilter {
  catch(erro: CardifyError, host: ArgumentsHost) {
    const resposta = host.switchToHttp().getResponse<FastifyReply>();
    const status = STATUS_POR_ERRO.find(([classe]) => erro instanceof classe)?.[1] ?? HttpStatus.BAD_REQUEST;
    void resposta.status(status).send({ erro: erro.codigo, mensagem: erro.message });
  }
}
