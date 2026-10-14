import path from 'node:path';

export const RAIZ = path.resolve(__dirname, '..');

export const PORTA_API = 4100;
export const PORTA_WEB = 3100;
export const URL_API = `http://localhost:${PORTA_API}`;
export const URL_WEB = `http://localhost:${PORTA_WEB}`;

export const NOME_BANCO = 'cardify_e2e';
export const URL_BANCO_ADMIN = 'postgres://postgres:postgres@localhost:5432/postgres';
export const URL_BANCO = `postgres://postgres:postgres@localhost:5432/${NOME_BANCO}`;

export const S3_ENDPOINT = 'http://localhost:9000';
export const S3_BUCKET = 'cardify-e2e';
export const S3_ACCESS_KEY_ID = 'minioadmin';
export const S3_SECRET_ACCESS_KEY = 'minioadmin';

/** Variáveis comuns aos três processos (API, worker, web). */
export const ENV_STACK: Record<string, string> = {
  NODE_ENV: 'development',
  LLM_PROVIDER: 'fake',
  PAGAMENTO_PROVIDER: 'fake',
  DATABASE_URL: URL_BANCO,
  S3_ENDPOINT,
  S3_REGION: 'us-east-1',
  S3_BUCKET,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_FORCE_PATH_STYLE: 'true',
  APP_URL: URL_WEB,
  API_URL: URL_API,
  PORT: String(PORTA_API),
  ANON_TETO_DIARIO_CENTAVOS: '100000000',
  LOG_LEVEL: 'warn',
};

export const FIXTURES = path.join(RAIZ, 'fixtures');
export const IMPORTADOR_ANKI = path.join(RAIZ, 'tools/anki/importar_apkg.py');
export const PYTHON_ANKI = path.join(RAIZ, 'tools/anki/.venv/bin/python');
