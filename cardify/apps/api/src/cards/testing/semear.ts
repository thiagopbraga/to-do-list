import {
  type CardRow,
  type Db,
  type JobRow,
  type NovoCard,
  anonSessions,
  cards,
  documents,
  jobs,
  users,
} from '@cardify/db';

let sequencia = 0;
const proximo = () => ++sequencia;

export async function criarUsuario(db: Db): Promise<string> {
  const [usuario] = await db.insert(users).values({ email: `usuario${proximo()}@teste.com` }).returning();
  return usuario.id;
}

export async function criarSessaoAnonima(db: Db): Promise<string> {
  const [sessao] = await db
    .insert(anonSessions)
    .values({ ipHash: `ip${proximo()}`, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
    .returning();
  return sessao.id;
}

export async function criarJob(
  db: Db,
  dono: { userId: string } | { anonSessionId: string },
  opcoes: { status?: JobRow['status']; nomeDocumento?: string } = {},
): Promise<{ jobId: string; documentId: string }> {
  const [documento] = await db
    .insert(documents)
    .values({
      ...dono,
      tipo: 'pdf',
      sha256: `sha${proximo()}`.padEnd(64, '0'),
      nome: opcoes.nomeDocumento ?? 'Aula de Fisiologia.pdf',
      storageKey: `docs/teste/${proximo()}/original`,
      status: 'processado',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .returning();
  const [job] = await db
    .insert(jobs)
    .values({
      ...dono,
      documentId: documento.id,
      status: opcoes.status ?? 'concluido',
      params: { densidade: 'equilibrado', tipo: 'misto', area: 'geral' },
      paramsHash: `hash${proximo()}`,
      orcamentoCentavos: 10,
    })
    .returning();
  return { jobId: job.id, documentId: documento.id };
}

export async function criarCard(db: Db, jobId: string, sobrescrita: Partial<NovoCard> = {}): Promise<CardRow> {
  const [card] = await db
    .insert(cards)
    .values({
      jobId,
      tipo: 'basico',
      frente: `Pergunta ${proximo()}?`,
      verso: 'Resposta',
      ordem: 0,
      ...sobrescrita,
    })
    .returning();
  return card;
}
