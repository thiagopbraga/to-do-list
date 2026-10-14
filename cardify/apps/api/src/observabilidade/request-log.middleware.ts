import type { IncomingMessage, ServerResponse } from 'node:http';
import { Store, storage } from 'nestjs-pino/storage';
import type { Logger } from 'pino';
import { resolverRequestId } from './logger';

type RequisicaoComLog = IncomingMessage & { id?: string; log?: Logger };

/**
 * Roda antes do pino-http. O Fastify já atribui `request.id` e o middie copia esse valor para `req.id`, então o
 * `genReqId` do pino-http nunca é chamado. Definir o id aqui faz os logs da requisição e o header usarem o mesmo valor.
 */
export function identificarRequisicao(req: RequisicaoComLog, res: ServerResponse, next: () => void): void {
  const id = resolverRequestId(req.headers['x-request-id']);
  req.id = id;
  res.setHeader('x-request-id', id);
  // O middie copia o `log` do Fastify (silencioso com `logger: false`); o pino-http só atribui o seu se o campo estiver vazio.
  delete (req as { log?: Logger }).log;
  delete (res as { log?: Logger }).log;
  next();
}

/** Vincula o `req.log` (já com o id) ao contexto assíncrono, para que o `Logger` do Nest escreva com o id da requisição. */
export function vincularLogger(req: RequisicaoComLog, _res: ServerResponse, next: () => void): void {
  if (!req.log) return next();
  storage.run(new Store(req.log), next);
}
