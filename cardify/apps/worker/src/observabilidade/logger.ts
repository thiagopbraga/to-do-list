import { type Env } from '@cardify/shared';
import type { Params } from 'nestjs-pino';

export function criarOpcoesLogger(env: Env): Params {
  return {
    pinoHttp: {
      level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    },
  };
}
