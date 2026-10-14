import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Env } from '@cardify/shared';
import type { Options } from 'pino-http';

/** Caminhos que nunca vão para o log (cookies, credenciais de provider e de sessão administrativa). */
export const CAMPOS_REDIGIDOS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["asaas-access-token"]',
  'req.headers["x-turnstile-token"]',
  'req.headers["x-admin-token"]',
  'res.headers["set-cookie"]',
];

const REQUEST_ID_ACEITO = /^[A-Za-z0-9._:-]{1,128}$/;

/** Usa o `x-request-id` recebido quando é seguro para log; senão gera um UUID. */
export function resolverRequestId(recebido: string | string[] | undefined): string {
  return typeof recebido === 'string' && REQUEST_ID_ACEITO.test(recebido) ? recebido : randomUUID();
}

export function criarOpcoesPino(env: Env): Options {
  return {
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    genReqId: (req, res) => {
      const id = resolverRequestId(req.headers['x-request-id']);
      res.setHeader('x-request-id', id);
      return id;
    },
    redact: { paths: CAMPOS_REDIGIDOS, censor: '[REDACTED]' },
    autoLogging: {
      // O middie remove o prefixo montado de `req.url`; `originalUrl` mantém o caminho completo.
      ignore: (req: IncomingMessage & { originalUrl?: string }) => (req.originalUrl ?? req.url)?.split('?')[0] === '/v1/health',
    },
  };
}
