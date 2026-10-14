import type { ParametrosGeracao } from '@cardify/shared';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Valores espelham os schemas zod de @cardify/shared (ver schema.int.test.ts).
export const planoEnum = pgEnum('plano', ['gratis', 'essencial', 'ilimitado', 'anual']);
export const assinaturaStatusEnum = pgEnum('assinatura_status', ['pendente', 'ativa', 'atrasada', 'cancelada']);
export const documentoTipoEnum = pgEnum('documento_tipo', ['pdf', 'texto']);
export const documentoStatusEnum = pgEnum('documento_status', [
  'aguardando_upload',
  'enviado',
  'processado',
  'invalido',
]);
export const jobStatusEnum = pgEnum('job_status', [
  'pendente',
  'ingerindo',
  'gerando',
  'empacotando',
  'concluido',
  'parcial',
  'falhou',
]);
export const estagioEnum = pgEnum('estagio', ['ingestao', 'geracao', 'empacotamento']);
export const cardTipoEnum = pgEnum('card_tipo', ['basico', 'cloze']);
export const cardEstadoEnum = pgEnum('card_estado', ['gerado', 'editado', 'descartado']);
export const exportFormatoEnum = pgEnum('export_formato', ['apkg', 'csv', 'tsv']);
export const exportStatusEnum = pgEnum('export_status', ['pendente', 'pronto', 'falhou']);

const criadoEm = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  nome: text('nome'),
  googleSub: text('google_sub').unique(),
  emailVerificadoEm: timestamp('email_verificado_em', { withTimezone: true }),
  providerCustomerId: text('provider_customer_id'),
  cpfCnpj: text('cpf_cnpj'),
  createdAt: criadoEm(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: criadoEm(),
});

export const magicLinks = pgTable('magic_links', {
  tokenHash: text('token_hash').primaryKey(),
  email: text('email').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usadoEm: timestamp('usado_em', { withTimezone: true }),
  createdAt: criadoEm(),
});

export const anonSessions = pgTable('anon_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ipHash: text('ip_hash').notNull(),
  geracoes: integer('geracoes').notNull().default(0),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: criadoEm(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  plano: planoEnum('plano').notNull(),
  status: assinaturaStatusEnum('status').notNull(),
  providerSubId: text('provider_sub_id').unique(),
  periodoInicio: timestamp('periodo_inicio', { withTimezone: true }),
  periodoFim: timestamp('periodo_fim', { withTimezone: true }),
  createdAt: criadoEm(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quotaPeriods = pgTable(
  'quota_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodoInicio: timestamp('periodo_inicio', { withTimezone: true }).notNull(),
    periodoFim: timestamp('periodo_fim', { withTimezone: true }).notNull(),
    limiteCards: integer('limite_cards').notNull(),
    cardsConfirmados: integer('cards_confirmados').notNull().default(0),
    cardsReservados: integer('cards_reservados').notNull().default(0),
  },
  (t) => [
    index('quota_periods_user_fim_idx').on(t.userId, t.periodoFim),
    check('quota_periods_cards_confirmados_ck', sql`${t.cardsConfirmados} >= 0`),
    check('quota_periods_cards_reservados_ck', sql`${t.cardsReservados} >= 0`),
  ],
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    anonSessionId: uuid('anon_session_id').references(() => anonSessions.id, { onDelete: 'cascade' }),
    tipo: documentoTipoEnum('tipo').notNull(),
    sha256: text('sha256').notNull(),
    nome: text('nome').notNull(),
    paginas: integer('paginas'),
    bytes: integer('bytes'),
    storageKey: text('storage_key').notNull(),
    textoExtraidoKey: text('texto_extraido_key'),
    status: documentoStatusEnum('status').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: criadoEm(),
  },
  (t) => [
    index('documents_user_sha256_idx').on(t.userId, t.sha256),
    check('documents_um_dono_ck', sql`(${t.userId} IS NULL) <> (${t.anonSessionId} IS NULL)`),
  ],
);

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    anonSessionId: uuid('anon_session_id').references(() => anonSessions.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    status: jobStatusEnum('status').notNull(),
    params: jsonb('params').$type<ParametrosGeracao>().notNull(),
    paramsHash: text('params_hash').notNull(),
    amostra: boolean('amostra').notNull().default(false),
    nome: text('nome'),
    orcamentoCentavos: doublePrecision('orcamento_centavos').notNull(),
    custoCentavos: doublePrecision('custo_centavos').notNull().default(0),
    cardsGerados: integer('cards_gerados').notNull().default(0),
    cardsReservados: integer('cards_reservados').notNull().default(0),
    estagioConcluido: estagioEnum('estagio_concluido'),
    idempotencyKey: text('idempotency_key'),
    erro: text('erro'),
    createdAt: criadoEm(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('jobs_user_created_idx').on(t.userId, t.createdAt),
    uniqueIndex('jobs_idempotency_key_uidx').on(t.idempotencyKey),
    check('jobs_um_dono_ck', sql`(${t.userId} IS NULL) <> (${t.anonSessionId} IS NULL)`),
  ],
);

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    ordem: integer('ordem').notNull(),
    trilhaTitulos: text('trilha_titulos')
      .array()
      .notNull()
      .default(sql`'{}'`),
    texto: text('texto').notNull(),
    tokens: integer('tokens').notNull(),
  },
  (t) => [unique('chunks_job_ordem_uq').on(t.jobId, t.ordem)],
);

export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    chunkId: uuid('chunk_id').references(() => chunks.id, { onDelete: 'set null' }),
    tipo: cardTipoEnum('tipo').notNull(),
    frente: text('frente').notNull(),
    verso: text('verso').notNull(),
    textoCloze: text('texto_cloze'),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'`),
    trilhaTitulos: text('trilha_titulos')
      .array()
      .notNull()
      .default(sql`'{}'`),
    fonteOffset: integer('fonte_offset').notNull().default(0),
    estado: cardEstadoEnum('estado').notNull().default('gerado'),
    ordem: integer('ordem').notNull(),
    substituiCardId: uuid('substitui_card_id').references((): AnyPgColumn => cards.id, {
      onDelete: 'set null',
    }),
    createdAt: criadoEm(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('cards_job_ordem_idx').on(t.jobId, t.ordem)],
);

export const exportacoes = pgTable('exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  formato: exportFormatoEnum('formato').notNull(),
  status: exportStatusEnum('status').notNull(),
  storageKey: text('storage_key'),
  bytes: integer('bytes'),
  erro: text('erro'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: criadoEm(),
});

export const llmCalls = pgTable(
  'llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    estagio: text('estagio').notNull(),
    modelo: text('modelo').notNull(),
    tokensIn: integer('tokens_in').notNull(),
    tokensOut: integer('tokens_out').notNull(),
    custoCentavos: doublePrecision('custo_centavos').notNull(),
    latenciaMs: integer('latencia_ms').notNull(),
    createdAt: criadoEm(),
  },
  (t) => [index('llm_calls_job_idx').on(t.jobId)],
);

export const webhookEvents = pgTable('webhook_events', {
  eventId: text('event_id').primaryKey(),
  provider: text('provider').notNull(),
  tipo: text('tipo').notNull(),
  payload: jsonb('payload').notNull(),
  recebidoEm: timestamp('recebido_em', { withTimezone: true }).notNull().defaultNow(),
});

export const anonGastoDiario = pgTable('anon_gasto_diario', {
  dia: date('dia', { mode: 'string' }).primaryKey(),
  gastoCentavos: doublePrecision('gasto_centavos').notNull().default(0),
});

export type UserRow = typeof users.$inferSelect;
export type NovoUser = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NovoSession = typeof sessions.$inferInsert;
export type MagicLinkRow = typeof magicLinks.$inferSelect;
export type NovoMagicLink = typeof magicLinks.$inferInsert;
export type AnonSessionRow = typeof anonSessions.$inferSelect;
export type NovoAnonSession = typeof anonSessions.$inferInsert;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NovoSubscription = typeof subscriptions.$inferInsert;
export type QuotaPeriodRow = typeof quotaPeriods.$inferSelect;
export type NovoQuotaPeriod = typeof quotaPeriods.$inferInsert;
export type DocumentRow = typeof documents.$inferSelect;
export type NovoDocument = typeof documents.$inferInsert;
export type JobRow = typeof jobs.$inferSelect;
export type NovoJob = typeof jobs.$inferInsert;
export type ChunkRow = typeof chunks.$inferSelect;
export type NovoChunk = typeof chunks.$inferInsert;
export type CardRow = typeof cards.$inferSelect;
export type NovoCard = typeof cards.$inferInsert;
export type ExportRow = typeof exportacoes.$inferSelect;
export type NovoExport = typeof exportacoes.$inferInsert;
export type LlmCallRow = typeof llmCalls.$inferSelect;
export type NovoLlmCall = typeof llmCalls.$inferInsert;
export type WebhookEventRow = typeof webhookEvents.$inferSelect;
export type NovoWebhookEvent = typeof webhookEvents.$inferInsert;
export type AnonGastoDiarioRow = typeof anonGastoDiario.$inferSelect;
export type NovoAnonGastoDiario = typeof anonGastoDiario.$inferInsert;
