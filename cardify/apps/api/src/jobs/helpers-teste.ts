import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { anonSessions, documents, jobs, users } from '@cardify/db';
import type { AppTeste } from '../testing/app-teste';

export const PARAMETROS = { densidade: 'equilibrado', tipo: 'misto', area: 'geral' } as const;

export function lerFixturePdf(nome: string): Buffer {
  return readFileSync(resolve(__dirname, '../../../../fixtures/pdf', nome));
}

export async function criarUsuario(t: AppTeste, email = 'ana@exemplo.com'): Promise<string> {
  const [u] = await t.banco.db.insert(users).values({ email }).returning();
  return u.id;
}

export async function criarSessaoAnonima(t: AppTeste): Promise<string> {
  const [s] = await t.banco.db
    .insert(anonSessions)
    .values({ ipHash: 'ip', expiresAt: new Date(Date.now() + 86_400_000) })
    .returning();
  return s.id;
}

export const comoUsuario = (id: string) => ({ 'x-teste-user': id });
export const comoAnonimo = (id: string) => ({ 'x-teste-anon': id });

/** Texto com `paragrafos` blocos de 600 caracteres; `marca` diferencia o conteúdo (e o SHA). */
export function textoDeEstudo(paragrafos: number, marca = 'a'): string {
  return (`Conteúdo ${marca}. ` + 'x'.repeat(600)).repeat(paragrafos).slice(0, paragrafos * 600);
}

export async function inserirJobDireto(
  t: AppTeste,
  dono: { userId?: string; anonSessionId?: string },
  extra: Partial<typeof jobs.$inferInsert> = {},
) {
  const [doc] = await t.banco.db
    .insert(documents)
    .values({
      userId: dono.userId ?? null,
      anonSessionId: dono.anonSessionId ?? null,
      tipo: 'texto',
      sha256: 'abc',
      nome: 'Doc',
      storageKey: 'k',
      status: 'enviado',
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  const [job] = await t.banco.db
    .insert(jobs)
    .values({
      userId: dono.userId ?? null,
      anonSessionId: dono.anonSessionId ?? null,
      documentId: doc.id,
      status: 'pendente',
      params: PARAMETROS,
      paramsHash: 'h',
      orcamentoCentavos: 15,
      ...extra,
    })
    .returning();
  return job;
}
