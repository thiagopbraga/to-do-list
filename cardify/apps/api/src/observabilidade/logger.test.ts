import { Writable } from 'node:stream';
import { carregarEnv } from '@cardify/shared';
import pino from 'pino';
import { CAMPOS_REDIGIDOS, criarOpcoesPino, resolverRequestId } from './logger';

function capturar(): { log: pino.Logger; linhas: () => Record<string, unknown>[] } {
  const saida: string[] = [];
  const destino = new Writable({
    write(chunk, _enc, cb) {
      saida.push(chunk.toString());
      cb();
    },
  });
  const log = pino({ redact: { paths: CAMPOS_REDIGIDOS, censor: '[REDACTED]' }, level: 'info' }, destino);
  return { log, linhas: () => saida.join('').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>) };
}

describe('redação de campos sensíveis', () => {
  it('oculta cookies, credenciais de provider, token admin e set-cookie', () => {
    const { log, linhas } = capturar();

    log.info({
      req: {
        headers: {
          cookie: 'sessao=segredo',
          authorization: 'Bearer abc',
          'asaas-access-token': 'asaas-segredo',
          'x-turnstile-token': 'turnstile-segredo',
          'x-admin-token': 'admin-segredo',
          'user-agent': 'teste',
        },
      },
      res: { headers: { 'set-cookie': ['cardify_sessao=valor'], 'content-type': 'application/json' } },
    });

    const texto = JSON.stringify(linhas());
    for (const valor of ['segredo', 'Bearer abc', 'asaas-segredo', 'turnstile-segredo', 'admin-segredo', 'cardify_sessao=valor']) {
      expect(texto).not.toContain(valor);
    }
    expect(texto).toContain('[REDACTED]');
    expect(texto).toContain('teste');
    expect(texto).toContain('application/json');
  });
});

describe('criarOpcoesPino', () => {
  it('em NODE_ENV=test força silent, mesmo com LOG_LEVEL=debug', () => {
    const opcoes = criarOpcoesPino(carregarEnv({ NODE_ENV: 'test', LOG_LEVEL: 'debug' }));

    expect(opcoes).toMatchObject({ level: 'silent' });
  });

  it('usa LOG_LEVEL fora de test e só liga pino-pretty em development', () => {
    const prod = criarOpcoesPino(carregarEnv({ NODE_ENV: 'production', LOG_LEVEL: 'warn', SESSION_SECRET: 'x'.repeat(32), LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', PAGAMENTO_PROVIDER: 'asaas', ASAAS_API_KEY: 'k', ASAAS_WEBHOOK_TOKEN: 't', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b' }));
    const dev = criarOpcoesPino(carregarEnv({ NODE_ENV: 'development', LOG_LEVEL: 'info' }));

    expect(prod).toMatchObject({ level: 'warn' });
    expect(prod).not.toHaveProperty('transport');
    expect(dev).toMatchObject({ level: 'info', transport: { target: 'pino-pretty' } });
  });

  it('ignora autoLogging em /v1/health, com ou sem query string', () => {
    const { autoLogging } = criarOpcoesPino(carregarEnv({ NODE_ENV: 'development' })) as {
      autoLogging: { ignore: (req: { url?: string; originalUrl?: string }) => boolean };
    };

    expect(autoLogging.ignore({ url: '/v1/health' })).toBe(true);
    expect(autoLogging.ignore({ url: '/v1/health?x=1' })).toBe(true);
    expect(autoLogging.ignore({ url: '/health', originalUrl: '/v1/health' })).toBe(true);
    expect(autoLogging.ignore({ url: '/v1/me' })).toBe(false);
  });
});

describe('resolverRequestId', () => {
  it('aceita um x-request-id seguro e gera UUID para valores ausentes ou inseguros', () => {
    expect(resolverRequestId('pedido-42.a:b')).toBe('pedido-42.a:b');
    expect(resolverRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolverRequestId('com espaço')).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolverRequestId('a'.repeat(129))).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolverRequestId(['um', 'dois'])).toMatch(/^[0-9a-f-]{36}$/);
  });
});
