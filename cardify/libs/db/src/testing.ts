import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import type { Pool } from 'pg';
import { criarDb, type Db } from './client';
import { migrar } from './migrar';
import * as schema from './schema';

const CONEXAO_PADRAO = 'postgres://postgres:postgres@localhost:5432/cardify_test';

const tabelasDominio = Object.values(schema).flatMap((valor) => (is(valor, PgTable) ? [getTableName(valor)] : []));

export async function bancoDeTeste(): Promise<{
  db: Db;
  pool: Pool;
  limpar(): Promise<void>;
  fechar(): Promise<void>;
}> {
  const connectionString = process.env.DATABASE_URL_TEST ?? CONEXAO_PADRAO;
  await migrar(connectionString);
  const { db, pool } = criarDb(connectionString);
  return {
    db,
    pool,
    limpar: async () => {
      await db.execute(
        sql`TRUNCATE TABLE ${sql.join(
          tabelasDominio.map((nome) => sql.identifier(nome)),
          sql`, `,
        )} CASCADE`,
      );
    },
    fechar: () => pool.end(),
  };
}
