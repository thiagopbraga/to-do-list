import { z } from 'zod';

const SESSION_SECRET_DEV = 'dev-somente-local-troque-em-producao-0123456789';

const booleano = (padrao: boolean) =>
  z
    .enum(['true', 'false'])
    .default(padrao ? 'true' : 'false')
    .transform((valor) => valor === 'true');

const EnvBase = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().url().default('postgres://postgres:postgres@localhost:5432/cardify'),
  DATABASE_URL_TEST: z.string().url().default('postgres://postgres:postgres@localhost:5432/cardify_test'),

  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).default('cardify'),
  S3_ACCESS_KEY_ID: z.string().min(1).default('minioadmin'),
  S3_SECRET_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  S3_FORCE_PATH_STYLE: booleano(true),

  LLM_PROVIDER: z.enum(['fake', 'anthropic']).default('fake'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  LLM_MODELO_ECONOMICO: z.string().min(1).default('claude-haiku-5-5'),
  LLM_MODELO_FORTE: z.string().min(1).default('claude-sonnet-5-5'),
  USD_BRL: z.coerce.number().positive().default(5.4),

  PAGAMENTO_PROVIDER: z.enum(['fake', 'asaas']).default('fake'),
  ASAAS_API_KEY: z.string().min(1).optional(),
  ASAAS_BASE_URL: z.string().url().default('https://api-sandbox.asaas.com/v3'),
  ASAAS_WEBHOOK_TOKEN: z.string().min(1).optional(),

  SESSION_SECRET: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:4000/v1/auth/google/callback'),

  SMTP_URL: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default('Cardify <noreply@cardify.local>'),

  TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET: z.string().min(1).optional(),

  ANON_TETO_DIARIO_CENTAVOS: z.coerce.number().int().nonnegative().default(2000),
  /** true atrás de proxy reverso/PaaS: `request.ip` passa a vir de X-Forwarded-For (limite anônimo por IP). */
  TRUST_PROXY: booleano(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export const EnvSchema = EnvBase.superRefine((env, ctx) => {
  if (env.LLM_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ANTHROPIC_API_KEY'],
      message: 'obrigatória quando LLM_PROVIDER=anthropic',
    });
  }

  if (env.PAGAMENTO_PROVIDER === 'asaas') {
    if (!env.ASAAS_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ASAAS_API_KEY'],
        message: 'obrigatória quando PAGAMENTO_PROVIDER=asaas',
      });
    }
    if (!env.ASAAS_WEBHOOK_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ASAAS_WEBHOOK_TOKEN'],
        message: 'obrigatória quando PAGAMENTO_PROVIDER=asaas',
      });
    }
  }

  if (env.NODE_ENV === 'production' && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SESSION_SECRET'],
      message: 'obrigatória em production, com pelo menos 32 caracteres',
    });
  }

  if (env.NODE_ENV === 'production' && (env.S3_ACCESS_KEY_ID === 'minioadmin' || env.S3_SECRET_ACCESS_KEY === 'minioadmin')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['S3_ACCESS_KEY_ID'],
      message: 'credenciais de desenvolvimento do MinIO não são aceitas em production',
    });
  }
}).transform((env) => ({ ...env, SESSION_SECRET: env.SESSION_SECRET ?? SESSION_SECRET_DEV }));

export type Env = z.infer<typeof EnvSchema>;

export function carregarEnv(fonte: Record<string, string | undefined> = process.env): Env {
  const preenchidas = Object.fromEntries(
    Object.entries(fonte).filter(([, valor]) => valor !== undefined && valor.trim() !== ''),
  );
  const resultado = EnvSchema.safeParse(preenchidas);
  if (!resultado.success) {
    const invalidas = resultado.error.issues.map((issue) => {
      const nome = issue.path.join('.') || '(raiz)';
      return `  - ${nome}: ${issue.message}`;
    });
    throw new Error(`Variáveis de ambiente inválidas:\n${invalidas.join('\n')}`);
  }
  return resultado.data;
}
