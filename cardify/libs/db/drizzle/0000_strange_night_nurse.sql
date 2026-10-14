CREATE TYPE "public"."assinatura_status" AS ENUM('pendente', 'ativa', 'atrasada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."card_estado" AS ENUM('gerado', 'editado', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."card_tipo" AS ENUM('basico', 'cloze');--> statement-breakpoint
CREATE TYPE "public"."documento_status" AS ENUM('aguardando_upload', 'enviado', 'processado', 'invalido');--> statement-breakpoint
CREATE TYPE "public"."documento_tipo" AS ENUM('pdf', 'texto');--> statement-breakpoint
CREATE TYPE "public"."estagio" AS ENUM('ingestao', 'geracao', 'empacotamento');--> statement-breakpoint
CREATE TYPE "public"."export_formato" AS ENUM('apkg', 'csv', 'tsv');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('pendente', 'pronto', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pendente', 'ingerindo', 'gerando', 'empacotando', 'concluido', 'parcial', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."plano" AS ENUM('gratis', 'essencial', 'ilimitado', 'anual');--> statement-breakpoint
CREATE TABLE "anon_gasto_diario" (
	"dia" date PRIMARY KEY NOT NULL,
	"gasto_centavos" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anon_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"geracoes" integer DEFAULT 0 NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"chunk_id" uuid,
	"tipo" "card_tipo" NOT NULL,
	"frente" text NOT NULL,
	"verso" text NOT NULL,
	"texto_cloze" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"trilha_titulos" text[] DEFAULT '{}' NOT NULL,
	"fonte_offset" integer DEFAULT 0 NOT NULL,
	"estado" "card_estado" DEFAULT 'gerado' NOT NULL,
	"ordem" integer NOT NULL,
	"substitui_card_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"trilha_titulos" text[] DEFAULT '{}' NOT NULL,
	"texto" text NOT NULL,
	"tokens" integer NOT NULL,
	CONSTRAINT "chunks_job_ordem_uq" UNIQUE("job_id","ordem")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anon_session_id" uuid,
	"tipo" "documento_tipo" NOT NULL,
	"sha256" text NOT NULL,
	"nome" text NOT NULL,
	"paginas" integer,
	"bytes" integer,
	"storage_key" text NOT NULL,
	"texto_extraido_key" text,
	"status" "documento_status" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_um_dono_ck" CHECK (("documents"."user_id" IS NULL) <> ("documents"."anon_session_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"formato" "export_formato" NOT NULL,
	"status" "export_status" NOT NULL,
	"storage_key" text,
	"bytes" integer,
	"erro" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anon_session_id" uuid,
	"document_id" uuid NOT NULL,
	"status" "job_status" NOT NULL,
	"params" jsonb NOT NULL,
	"params_hash" text NOT NULL,
	"amostra" boolean DEFAULT false NOT NULL,
	"nome" text,
	"orcamento_centavos" double precision NOT NULL,
	"custo_centavos" double precision DEFAULT 0 NOT NULL,
	"cards_gerados" integer DEFAULT 0 NOT NULL,
	"cards_reservados" integer DEFAULT 0 NOT NULL,
	"estagio_concluido" "estagio",
	"idempotency_key" text,
	"erro" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_um_dono_ck" CHECK (("jobs"."user_id" IS NULL) <> ("jobs"."anon_session_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"estagio" text NOT NULL,
	"modelo" text NOT NULL,
	"tokens_in" integer NOT NULL,
	"tokens_out" integer NOT NULL,
	"custo_centavos" double precision NOT NULL,
	"latencia_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"periodo_inicio" timestamp with time zone NOT NULL,
	"periodo_fim" timestamp with time zone NOT NULL,
	"limite_cards" integer NOT NULL,
	"cards_confirmados" integer DEFAULT 0 NOT NULL,
	"cards_reservados" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quota_periods_cards_confirmados_ck" CHECK ("quota_periods"."cards_confirmados" >= 0),
	CONSTRAINT "quota_periods_cards_reservados_ck" CHECK ("quota_periods"."cards_reservados" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plano" "plano" NOT NULL,
	"status" "assinatura_status" NOT NULL,
	"provider_sub_id" text,
	"periodo_inicio" timestamp with time zone,
	"periodo_fim" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_provider_sub_id_unique" UNIQUE("provider_sub_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nome" text,
	"google_sub" text,
	"email_verificado_em" timestamp with time zone,
	"provider_customer_id" text,
	"cpf_cnpj" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"tipo" text NOT NULL,
	"payload" jsonb NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anon_sessions" ADD CONSTRAINT "anon_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_substitui_card_id_cards_id_fk" FOREIGN KEY ("substitui_card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_anon_session_id_anon_sessions_id_fk" FOREIGN KEY ("anon_session_id") REFERENCES "public"."anon_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_anon_session_id_anon_sessions_id_fk" FOREIGN KEY ("anon_session_id") REFERENCES "public"."anon_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_periods" ADD CONSTRAINT "quota_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_job_ordem_idx" ON "cards" USING btree ("job_id","ordem");--> statement-breakpoint
CREATE INDEX "documents_user_sha256_idx" ON "documents" USING btree ("user_id","sha256");--> statement-breakpoint
CREATE INDEX "jobs_user_created_idx" ON "jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_idempotency_key_uidx" ON "jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "llm_calls_job_idx" ON "llm_calls" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "quota_periods_user_fim_idx" ON "quota_periods" USING btree ("user_id","periodo_fim");