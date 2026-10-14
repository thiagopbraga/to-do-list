import { afterEach, vi } from 'vitest';
import { carregarEnv, EnvSchema } from './env';

const SEGREDO_32 = 'a'.repeat(32);
const PROVIDERS_REAIS = {
  LLM_PROVIDER: 'anthropic',
  ANTHROPIC_API_KEY: 'sk-teste',
  PAGAMENTO_PROVIDER: 'asaas',
  ASAAS_API_KEY: 'chave-asaas',
  ASAAS_WEBHOOK_TOKEN: 'token-webhook',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('carregarEnv: defaults de desenvolvimento', () => {
  it('sem variáveis, usa os valores de dev do compose', () => {
    const env = carregarEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.APP_URL).toBe('http://localhost:3000');
    expect(env.API_URL).toBe('http://localhost:4000');
    expect(env.DATABASE_URL_TEST).toBe('postgres://postgres:postgres@localhost:5432/cardify_test');
    expect(env.S3_ENDPOINT).toBe('http://localhost:9000');
    expect(env.S3_REGION).toBe('us-east-1');
    expect(env.S3_BUCKET).toBe('cardify');
    expect(env.S3_ACCESS_KEY_ID).toBe('minioadmin');
    expect(env.S3_SECRET_ACCESS_KEY).toBe('minioadmin');
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.LLM_PROVIDER).toBe('fake');
    expect(env.LLM_MODELO_ECONOMICO).toBe('claude-haiku-5-5');
    expect(env.LLM_MODELO_FORTE).toBe('claude-sonnet-5-5');
    expect(env.USD_BRL).toBe(5.4);
    expect(env.PAGAMENTO_PROVIDER).toBe('fake');
    expect(env.ASAAS_BASE_URL).toBe('https://api-sandbox.asaas.com/v3');
    expect(env.ANON_TETO_DIARIO_CENTAVOS).toBe(2000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('SESSION_SECRET ganha um valor de dev quando ausente fora de production', () => {
    const env = carregarEnv({ NODE_ENV: 'development' });

    expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('segredos opcionais ficam undefined quando ausentes', () => {
    const env = carregarEnv({});

    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ASAAS_API_KEY).toBeUndefined();
    expect(env.ASAAS_WEBHOOK_TOKEN).toBeUndefined();
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.SMTP_URL).toBeUndefined();
  });

  it('variável vazia equivale a ausente (ex.: .env copiado do .env.example)', () => {
    const env = carregarEnv({ LLM_PROVIDER: 'fake', ANTHROPIC_API_KEY: '', PORT: '' });

    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.PORT).toBe(4000);
  });

  it('usa process.env quando nenhuma fonte é passada', () => {
    vi.stubEnv('PORT', '4321');

    expect(carregarEnv().PORT).toBe(4321);
  });
});

describe('carregarEnv: coerção', () => {
  it('converte números a partir de string', () => {
    const env = carregarEnv({ PORT: '5000', USD_BRL: '5.40', ANON_TETO_DIARIO_CENTAVOS: '1500' });

    expect(env.PORT).toBe(5000);
    expect(env.USD_BRL).toBe(5.4);
    expect(env.ANON_TETO_DIARIO_CENTAVOS).toBe(1500);
  });

  it('rejeita número inválido e informa o nome da variável', () => {
    expect(() => carregarEnv({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => carregarEnv({ PORT: '70000' })).toThrow(/PORT/);
    expect(() => carregarEnv({ USD_BRL: '-1' })).toThrow(/USD_BRL/);
  });

  it('converte booleano a partir de "true" e "false"', () => {
    expect(carregarEnv({ S3_FORCE_PATH_STYLE: 'false' }).S3_FORCE_PATH_STYLE).toBe(false);
    expect(carregarEnv({ S3_FORCE_PATH_STYLE: 'true' }).S3_FORCE_PATH_STYLE).toBe(true);
  });

  it('"false" não vira true (armadilha do z.coerce.boolean)', () => {
    expect(carregarEnv({ S3_FORCE_PATH_STYLE: 'false' }).S3_FORCE_PATH_STYLE).not.toBe(true);
  });

  it('rejeita booleano fora de true/false', () => {
    expect(() => carregarEnv({ S3_FORCE_PATH_STYLE: 'sim' })).toThrow(/S3_FORCE_PATH_STYLE/);
  });

  it('rejeita provider fora da lista', () => {
    expect(() => carregarEnv({ LLM_PROVIDER: 'openai' })).toThrow(/LLM_PROVIDER/);
    expect(() => carregarEnv({ PAGAMENTO_PROVIDER: 'stripe' })).toThrow(/PAGAMENTO_PROVIDER/);
  });
});

describe('carregarEnv: regras condicionais (superRefine)', () => {
  it('LLM_PROVIDER=anthropic exige ANTHROPIC_API_KEY', () => {
    expect(() => carregarEnv({ LLM_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(carregarEnv({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-teste' }).ANTHROPIC_API_KEY).toBe('sk-teste');
  });

  it('LLM_PROVIDER=fake dispensa ANTHROPIC_API_KEY', () => {
    expect(() => carregarEnv({ LLM_PROVIDER: 'fake' })).not.toThrow();
  });

  it('PAGAMENTO_PROVIDER=asaas exige ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN', () => {
    expect(() => carregarEnv({ PAGAMENTO_PROVIDER: 'asaas' })).toThrow(/ASAAS_API_KEY[\s\S]*ASAAS_WEBHOOK_TOKEN/);
  });

  it('PAGAMENTO_PROVIDER=asaas aponta a variável que faltou', () => {
    expect(() => carregarEnv({ PAGAMENTO_PROVIDER: 'asaas', ASAAS_API_KEY: 'k' })).toThrow(/ASAAS_WEBHOOK_TOKEN/);
    expect(() => carregarEnv({ PAGAMENTO_PROVIDER: 'asaas', ASAAS_WEBHOOK_TOKEN: 't' })).toThrow(/ASAAS_API_KEY/);
    expect(() =>
      carregarEnv({ PAGAMENTO_PROVIDER: 'asaas', ASAAS_API_KEY: 'k', ASAAS_WEBHOOK_TOKEN: 't' }),
    ).not.toThrow();
  });

  it('NODE_ENV=production exige SESSION_SECRET', () => {
    expect(() => carregarEnv({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  });

  it('NODE_ENV=production rejeita SESSION_SECRET com menos de 32 caracteres', () => {
    expect(() => carregarEnv({ NODE_ENV: 'production', SESSION_SECRET: 'a'.repeat(31) })).toThrow(/SESSION_SECRET/);
  });

  it('NODE_ENV=production aceita SESSION_SECRET com 32 caracteres', () => {
    const env = carregarEnv({ ...PROVIDERS_REAIS, NODE_ENV: 'production', SESSION_SECRET: SEGREDO_32, S3_ACCESS_KEY_ID: 'chave', S3_SECRET_ACCESS_KEY: 'segredo' });

    expect(env.SESSION_SECRET).toBe(SEGREDO_32);
  });

  it('erro lista todas as regras condicionais violadas de uma vez', () => {
    let mensagem = '';
    try {
      carregarEnv({ LLM_PROVIDER: 'anthropic', PAGAMENTO_PROVIDER: 'asaas' });
    } catch (erro) {
      mensagem = (erro as Error).message;
    }

    expect(mensagem).toMatch(/^Variáveis de ambiente inválidas:/);
    expect(mensagem).toMatch(/ANTHROPIC_API_KEY/);
    expect(mensagem).toMatch(/ASAAS_API_KEY/);
    expect(mensagem).toMatch(/ASAAS_WEBHOOK_TOKEN/);
  });

  it('campo com tipo inválido é reportado pelo nome', () => {
    expect(() => carregarEnv({ PORT: 'x', USD_BRL: 'y' })).toThrow(/PORT[\s\S]*USD_BRL/);
  });

  it('EnvSchema pode ser usado direto com safeParse', () => {
    expect(EnvSchema.safeParse({ PORT: '4001' }).success).toBe(true);
    expect(EnvSchema.safeParse({ PORT: 'x' }).success).toBe(false);
  });
});

describe('variáveis de observabilidade (opcionais)', () => {
  it('ausentes: sem ADMIN_TOKEN, sem OTEL e com teto de gasto diário de 5000 centavos', () => {
    const env = carregarEnv({});

    expect(env.ADMIN_TOKEN).toBeUndefined();
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
    expect(env.ALERTA_GASTO_DIARIO_CENTAVOS).toBe(5000);
  });

  it('ADMIN_TOKEN, quando presente, precisa de pelo menos 32 caracteres', () => {
    expect(() => carregarEnv({ ADMIN_TOKEN: 'a'.repeat(31) })).toThrow(/ADMIN_TOKEN/);
    expect(carregarEnv({ ADMIN_TOKEN: SEGREDO_32 }).ADMIN_TOKEN).toBe(SEGREDO_32);
  });

  it('ADMIN_TOKEN vazio equivale a ausente (rota de métricas desligada)', () => {
    expect(carregarEnv({ ADMIN_TOKEN: '' }).ADMIN_TOKEN).toBeUndefined();
  });

  it('OTEL_EXPORTER_OTLP_ENDPOINT precisa ser uma URL', () => {
    expect(() => carregarEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: 'otlp-local' })).toThrow(/OTEL_EXPORTER_OTLP_ENDPOINT/);
    expect(carregarEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318' }).OTEL_EXPORTER_OTLP_ENDPOINT).toBe(
      'http://localhost:4318',
    );
  });

  it('ALERTA_GASTO_DIARIO_CENTAVOS é inteiro não negativo', () => {
    expect(carregarEnv({ ALERTA_GASTO_DIARIO_CENTAVOS: '120' }).ALERTA_GASTO_DIARIO_CENTAVOS).toBe(120);
    expect(() => carregarEnv({ ALERTA_GASTO_DIARIO_CENTAVOS: '1.5' })).toThrow(/ALERTA_GASTO_DIARIO_CENTAVOS/);
    expect(() => carregarEnv({ ALERTA_GASTO_DIARIO_CENTAVOS: '-1' })).toThrow(/ALERTA_GASTO_DIARIO_CENTAVOS/);
  });
});

describe('providers fake em production', () => {
  it('recusa pagamento e LLM fake', () => {
    expect(() => carregarEnv({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), S3_ACCESS_KEY_ID: 'chave', S3_SECRET_ACCESS_KEY: 'segredo' })).toThrow(
      /PAGAMENTO_PROVIDER[\s\S]*LLM_PROVIDER|LLM_PROVIDER[\s\S]*PAGAMENTO_PROVIDER/,
    );
  });
});

describe('credenciais de desenvolvimento em production', () => {
  it('recusa minioadmin com NODE_ENV=production', () => {
    expect(() =>
      carregarEnv({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), S3_ACCESS_KEY_ID: 'minioadmin', S3_SECRET_ACCESS_KEY: 'segredo-real' }),
    ).toThrow(/S3_ACCESS_KEY_ID/);
  });

  it('aceita credenciais próprias em production', () => {
    const env = carregarEnv({ ...PROVIDERS_REAIS, NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), S3_ACCESS_KEY_ID: 'chave', S3_SECRET_ACCESS_KEY: 'segredo' });
    expect(env.S3_ACCESS_KEY_ID).toBe('chave');
  });
});
