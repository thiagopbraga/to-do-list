import { createHash, randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { URL_BANCO } from '../ambiente';

let pool: Pool | undefined;

export function banco(): Pool {
  pool ??= new Pool({ connectionString: URL_BANCO, max: 4 });
  return pool;
}

export async function fecharBanco(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/** Esvazia todas as tabelas de domínio (o schema `pgboss` fica intacto: o worker continua assinando a fila). */
export async function limparDados(): Promise<void> {
  const { rows } = await banco().query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  if (rows.length === 0) return;
  const tabelas = rows.map((r) => `"${r.tablename}"`).join(', ');
  await banco().query(`TRUNCATE TABLE ${tabelas} RESTART IDENTITY CASCADE`);
}

export const sha256Hex = (valor: string): string => createHash('sha256').update(valor).digest('hex');

export function emailUnico(prefixo: string): string {
  return `${prefixo}-${randomBytes(4).toString('hex')}@e2e.cardify.test`;
}

/** Grava um magic link válido por 15 minutos e devolve o token em claro (o banco guarda só o hash). */
export async function inserirMagicLink(email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await banco().query('INSERT INTO magic_links (token_hash, email, expires_at) VALUES ($1, $2, $3)', [
    sha256Hex(token),
    email.toLowerCase(),
    new Date(Date.now() + 15 * 60_000),
  ]);
  return token;
}

export interface UsuarioRow {
  id: string;
  email: string;
}

export async function usuarioPorEmail(email: string): Promise<UsuarioRow | null> {
  const { rows } = await banco().query<UsuarioRow>('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] ?? null;
}

export interface JobRow {
  id: string;
  user_id: string | null;
  anon_session_id: string | null;
  status: string;
  amostra: boolean;
  cards_gerados: number;
  erro: string | null;
}

export async function jobPorId(id: string): Promise<JobRow | null> {
  const { rows } = await banco().query<JobRow>(
    'SELECT id, user_id, anon_session_id, status, amostra, cards_gerados, erro FROM jobs WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

export interface CardBanco {
  id: string;
  tipo: 'basico' | 'cloze';
  frente: string;
  verso: string;
  texto_cloze: string | null;
  estado: 'gerado' | 'editado' | 'descartado';
}

export async function cardsDoJob(jobId: string): Promise<CardBanco[]> {
  const { rows } = await banco().query<CardBanco>(
    'SELECT id, tipo, frente, verso, texto_cloze, estado FROM cards WHERE job_id = $1 ORDER BY ordem',
    [jobId],
  );
  return rows;
}

export async function providerSubIdDoUsuario(userId: string): Promise<string | null> {
  const { rows } = await banco().query<{ provider_sub_id: string | null }>(
    'SELECT provider_sub_id FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId],
  );
  return rows[0]?.provider_sub_id ?? null;
}
