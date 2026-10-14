# Plano — Cardify (Gerador de Flashcards com IA), execução por sub-agentes

## Contexto

O PRD (Cardify v1.0) e a RFC-001 v1.1 (backend NestJS) definem um produto que transforma PDF/texto em flashcards e exporta `.apkg` importável no Anki sem erro e sem duplicata. O pedido é dividir a construção em tasks que **sub-agentes com modelos mais baratos** executam, enquanto o **modelo principal** faz o gerenciamento: escreve os contratos, distribui as tasks, valida cada entrega e integra.

O repositório atual (`thiagopbraga/to-do-list`) contém o TaskFlow (Vite + React). Para não destruir nada, o Cardify nasce em uma pasta própria **`cardify/`** neste repositório, na branch `claude/sistema-sub-agentes-validacao-amiauv`. Ambiente disponível: Node 22, npm 10, Docker, Postgres 16.

Escopo deste plano: **F1 — MVP (RF-01 a RF-10)**. F0 (validação manual), F2 (OCR, YouTube, questões) e F3 (retenção) ficam fora.

### Decisões assumidas (ajustáveis antes de executar)
- **LLM:** Claude via `@anthropic-ai/sdk` — Haiku 5.5 no estágio A (extração), Sonnet 5.5 no estágio B (formulação), atrás de uma interface `LlmProvider` com um `FakeLlmProvider` determinístico para testes e desenvolvimento. Consultar a skill `claude-api` antes de implementar o cliente.
- **Pagamento:** Asaas (Pix + cartão + boleto, cobrança em real), atrás da interface `PagamentoProvider`, com um fake para testes.
- **Auth:** sessão HttpOnly própria + Google OAuth + magic link por e-mail.
- **Storage:** compatível com S3 (MinIO no docker-compose de dev).
- **Monorepo:** npm workspaces (mesmo gerenciador do repositório).

---

## Modelo de orquestração

### Papéis
| Papel | Modelo | Responsabilidade |
|---|---|---|
| **Gerente/validador** | modelo principal (Opus) | Task T00 (contratos), prompts das tasks, revisão de diff, execução das verificações, decisão de aceite, commits e push |
| **Executor mecânico** | `haiku` | Tasks com especificação fechada: CRUD, schemas, funções puras com regras explícitas, UI simples, config |
| **Executor sensível** | `sonnet` | Tasks com armadilhas técnicas: empacotador `.apkg`, agrupamento de linhas do PDF, prompts, transação de cota, pipeline do worker, webhook |

### Regras para evitar conflito entre agentes paralelos
1. **Contrato antes de código:** T00 (feito pelo modelo principal) cria toda a estrutura, interfaces TypeScript, schemas zod e **instala todas as dependências** previstas na RFC. Sub-agentes **não** rodam `npm install` nem editam `package-lock.json`; se precisarem de dependência nova, reportam e o gerente adiciona entre ondas.
2. **Posse exclusiva de arquivos:** cada task lista as pastas que pode alterar. Tocar fora disso é motivo de reprovação.
3. **Interfaces congeladas:** sub-agente implementa a interface de `libs/shared/src/contracts/*`; não muda a assinatura. Se precisar mudar, reporta.
4. Agentes de uma mesma onda rodam em paralelo (background); a onda seguinte só começa depois que o gerente aprovar a anterior e fizer commit.

### Prompt padrão de cada task (montado pelo gerente)
- Trecho **literal** das seções relevantes do PRD/RFC (não o documento inteiro — economiza tokens do modelo barato).
- Arquivos/pastas que pode alterar; interfaces que deve implementar.
- Critérios de aceite numerados e os comandos exatos para verificar (`npm run -w <pkg> test|lint|typecheck`).
- Formato de retorno: lista de arquivos alterados, saída dos comandos, desvios ou dúvidas.

### Protocolo de validação (modelo principal, a cada task)
1. Rodar os comandos de verificação por conta própria (não confiar no relato do agente).
2. Ler o diff e conferir cada critério de aceite e a posse de arquivos.
3. Checagens específicas por task (listadas abaixo como **Validação extra**).
4. Reprovado → `SendMessage` para o mesmo agente com as falhas concretas (até 2 rodadas). Persistindo, escalar: haiku → sonnet → o próprio gerente corrige.
5. Aprovado → commit por task (`feat(cardify): ...`) e push ao fim de cada onda.

---

## Estrutura alvo

```
cardify/
  package.json (workspaces) · docker-compose.yml · Dockerfile (node:22-bookworm-slim)
  apps/api      NestJS + Fastify (HTTP, SSE, webhooks)
  apps/worker   NestJS createApplicationContext (sem HTTP)
  apps/web      Next.js + Tailwind
  libs/shared   zod schemas, tipos, constantes (MODEL_ID_*), contracts/
  libs/db       Drizzle schema + migrations (§6)
  libs/ingest   pdfjs-dist, agrupamento de linhas, limpeza, chunking, runner isolado
  libs/generation  LlmProvider, prompts, estágios A/B, cloze, dedup, orçamento
  libs/apkg     empacotador .apkg + CSV/TSV
  libs/queue    FilaService (pg-boss) + progresso via LISTEN/NOTIFY
  libs/storage  StorageService (S3/MinIO)
  fixtures/     PDFs de teste, seed collection.anki2
  tools/anki-check/  container Python com Anki headless (só CI)
```

---

## Tasks

Legenda: **[H]** haiku · **[S]** sonnet · **[P]** modelo principal

### Onda 0 — Fundação (sequencial, gerente)
**T00 [P] Esqueleto e contratos.** Workspaces, tsconfig base, eslint, vitest; instalação de todas as dependências da RFC §2.1; `libs/shared` com `CardSchema`/`RespostaGeracaoSchema` (RFC §4.2), enum de status de job, parâmetros de geração (densidade, tipo, área), `MODEL_ID_BASICO/CLOZE`; interfaces em `libs/shared/src/contracts/`: `LlmProvider`, `FilaService`, `StorageService`, `PagamentoProvider`, `PdfExtractor`, `ApkgPacker`. Esqueletos vazios de api/worker/web compilando.
Verificação: `npm run typecheck && npm test` verdes na raiz de `cardify/`.

### Onda 1 — Infra, dados e fixtures (paralelo)
- **T01 [H] Infra local.** `docker-compose.yml` (Postgres 16, MinIO), Dockerfile multi-stage bookworm-slim com toolchain para `better-sqlite3`, `.env.example`, módulo de config do Nest. Aceite: `docker compose up -d` sobe; a imagem compila `better-sqlite3`.
- **T02 [H] Schema Drizzle (RFC §6).** Todas as tabelas, índices `documents(user_id, sha256)` e `cards(job_id, ordem)`, `cards.estado` com soft delete, migrations geradas. Aceite: migration aplica no Postgres do compose; pg-boss fica em schema separado.
- **T03 [S] Fixtures.** (a) Seed `collection.anki2` vazia gerada pelo próprio Anki (pacote Python `anki`) no formato legado aceito no `.apkg`, com script reproduzível em `tools/`; (b) 4–5 PDFs de teste: aula densa com títulos, lei seca, slide exportado, PDF com cabeçalho/rodapé/marca d'água repetidos, PDF escaneado sem texto — cada um com JSON do resultado esperado (linhas, títulos, ruído removido).
  **Validação extra:** o gerente abre a seed com `sqlite3` e confere tabelas `col/notes/cards/revlog/graves`.

### Onda 2 — Núcleos independentes (paralelo, maior onda)
- **T04 [S] Extração + agrupamento de linhas (RFC §3.2).** `PdfExtractor` com `pdfjs-dist`: tamanho de fonte por `hypot`, `y` normalizado, negrito por `fontName`, agrupamento (ordem y↓ x↑, tolerância de meia linha, espaço com gap > 25%). Detecção de escaneado (< 80 caracteres/página). Aceite: bate com o JSON esperado dos fixtures do T03.
- **T05 [H] Limpeza de cabeçalho/rodapé (RFC §3.3).** Função pura: faixas de 8%, normalização (sem dígitos, minúsculas, sem acento), remover linhas em > 60% das páginas. Aceite: testes unitários + fixture com marca d'água.
- **T06 [S] Chunking semântico (RFC §3.4).** Hierarquia por tamanho modal de fonte, corte em títulos, subdivisão > 2.000 tokens com sobreposição de 120, fusão < 200, trilha de títulos, fallback por parágrafo duplo, `js-tiktoken`.
- **T07 [S] Runner de parsing isolado (RFC §3.1).** `child_process.fork` com `--max-old-space-size`, timeout duro de 10 min, validação por magic bytes (`file-type`), SHA-256 em stream, limites de 50 MB/300 páginas. Aceite: teste com PDF corrompido derruba o filho e não o pai.
- **T08 [H] Validador de cloze (RFC §4.3).** Regex dada, 5 regras, retorno com motivo da reprovação. Aceite: tabela de casos válidos/inválidos.
- **T09 [H] Deduplicação (RFC §4.4).** Normalização NFD, stopwords pt-BR, shingles de 3, Jaccard 0,85, mantém o verso mais curto.
- **T10 [S] Cliente LLM + ledger + orçamento (RFC §4.5).** `AnthropicLlmProvider` e `FakeLlmProvider`; interceptor que grava toda chamada em `llm_calls`; débito de custo estimado antes de cada chamada e exceção de orçamento esgotado que leva a "sucesso parcial". Saída estruturada validada com zod e uma tentativa de reparo.
  **Validação extra:** o gerente confere que nenhuma chamada contorna o interceptor (grep por uso direto do SDK).
- **T11 [S] Empacotador `.apkg` (RFC §5) — task crítica.** Copiar seed → `better-sqlite3` → sobrescrever `models`/`decks` em `col` → inserir `notes` (flds com `\x1f`, sfld, csum por sha1) e `cards` (cloze: uma linha por índice distinto, `ord = índice − 1`) → zipar com `archiver` + `media` `{}`. GUID = `base91(sha1(card.id)[0..8])`; IDs fixos de modelo; contador anti-colisão de ids; subdecks `::` até 3 níveis; tags `cardify::<doc>::<secao>`; note type cloze com `type: 1` e `{{cloze:Texto}}`.
  **Validação extra:** o gerente revisa linha a linha contra a RFC §5.2–5.6 e roda os itens 1, 2 e 5 da §9 manualmente sobre um baralho gerado.
- **T12 [S] FilaService pg-boss + progresso.** `send` com `retryLimit 3`, backoff, `expireInMinutes 20`, `singletonKey`; publicação de progresso via `NOTIFY` e assinatura via `LISTEN` convertida em Observable.
- **T13 [H] StorageService.** URL assinada de upload/download (TTL 15 min), chave por usuário, exclusão.
- **T14 [H] Export CSV/TSV (RF-07).** Formato importável pelo Anki/AnkiDroid, com escape correto e cloze preservado.

### Onda 3 — Composição (paralelo, depende da Onda 2)
- **T15 [S] Prompts e estágios A/B (RFC §4.1, PRD RF-03/04).** Prompt do estágio A (fatos atômicos tipados) e do B com as 6 regras do princípio da informação mínima, controles de densidade/tipo/área, pt-BR preservando termos técnicos; orquestração que aplica cloze → reformulação → conversão para básico, e depois dedup.
  **Validação extra:** o gerente roda uma geração real (se houver chave) sobre um fixture e lê uma amostra de 20 cards contra as 6 regras.
- **T16 [S] Pipeline do worker.** Job `gerar-baralho`: ingestão → geração → persistência dos cards, com checkpoint por estágio no banco (falha no estágio 3 não refaz 1 e 2), status `pendente…parcial|falhou`, progresso publicado, chunk inválido descartado sem derrubar o job.
- **T17 [S] Suíte de integração `.apkg` (RFC §9) — gate do projeto.** Itens 1–5 em vitest; item 6 com `tools/anki-check` (container Python com Anki headless) importando o arquivo, reimportando e conferindo que não há duplicata; edição + reexportação atualiza a nota.
  **Gate:** se não ficar verde após 2 rodadas de correção, o gerente aciona a opção B da RFC (sidecar Python com `genanki`) sem discussão.
- **T18 [S] Cota com reserva/confirmação (RFC §7.3).** Transação com `FOR UPDATE`, reserva na criação do job, confirmação proporcional no fim, liberação em falha/expiração. Aceite: teste de concorrência com 2 jobs simultâneos não estoura o limite.
- **T19 [S] API de jobs.** `POST /uploads`, `POST /jobs` (guard de `Idempotency-Key`, chave = sha256(user+doc+params), cache por documento do mesmo usuário), `GET /jobs/:id`, SSE `/jobs/:id/events`.
- **T20 [H] API de cards e exports.** `GET /jobs/:id/cards` paginado, `PATCH`/`DELETE` (soft) `/cards/:id`, `POST /cards/:id/regenerate` (novo UUID), `POST /exports`, `GET /exports/:id/download`.

### Onda 4 — Produto e monetização (paralelo)
- **T21 [S] Autenticação (RF-08).** Sessão HttpOnly, Google OAuth, magic link; vinculação do job anônimo ao novo usuário no cadastro.
- **T22 [S] Pagamento + planos (RF-09/10).** Asaas: assinatura Pix/cartão, webhook com `rawBody` e assinatura verificada, idempotência por `eventId`, criação de `quota_periods` conforme a tabela de planos do PRD §10.
- **T23 [S] Fluxo anônimo (RFC §8.1).** Cookie assinado de 24h, teto de 10 cards/15 páginas/5 MB, 2 gerações por IP/dia (`@nestjs/throttler`), Turnstile a partir da segunda, teto global diário de gasto com desligamento.
- **T24 [H] Front: landing + entrada.** Colar texto ou subir PDF sem login, controles de densidade/tipo/área, progresso via SSE com fallback de polling, amostra de 10 cards.
- **T25 [S] Front: tela de revisão (RF-05).** Edição inline, excluir, seleção múltipla, reordenar, tags por seção, regenerar card; tipos importados de `libs/shared` (mesmo zod do back).
- **T26 [H] Front: login, paywall, planos, exportação.** Fluxo "Gerar os N cards restantes" → login → paywall → revisão → download `.apkg`/CSV.
- **T27 [H] Observabilidade (RFC §10).** `nestjs-pino`, OpenTelemetry, métricas por job (custo, descarte, tempo até primeiro card).

### Onda 5 — Fechamento
- **T28 [H] E2E Playwright** do fluxo do PRD §7 com `FakeLlmProvider` e `FakePagamentoProvider`.
- **T29 [H] CI.** Workflow para `cardify/` (lint, typecheck, unit, integração com Postgres de serviço, suíte `.apkg` com Anki headless) + job semanal contra o Anki mais recente; `npm audit`. O CI atual do TaskFlow continua intacto.
- **T30 [P] Revisão final** de segurança e critérios de aceite do PRD §14 (pode usar `/security-review` e `/code-review`).

### Resumo de distribuição
| Modelo | Tasks |
|---|---|
| Principal | T00, T30 + validação de todas |
| Sonnet | T03, T04, T06, T07, T10, T11, T12, T15, T16, T17, T18, T19, T21, T22, T23, T25 |
| Haiku | T01, T02, T05, T08, T09, T13, T14, T20, T24, T26, T27, T28, T29 |

---

## Verificação ponta a ponta

1. `cd cardify && docker compose up -d && npm run db:migrate`
2. `npm run lint && npm run typecheck && npm test` — todos os pacotes verdes.
3. `npm run test:apkg` — suíte da RFC §9, incluindo importação real no Anki headless, reimportação sem duplicata e edição que atualiza a nota.
4. Subir api + worker + web com `LLM_PROVIDER=fake` e `PAGAMENTO_PROVIDER=fake`; executar o fluxo do PRD §7 no navegador (Playwright): colar texto → amostra → login → paywall fake → revisão → exportar `.apkg`.
5. Com chave real da Anthropic: processar o fixture de aula de 40 páginas, medir tempo (< 2 min para 80+ cards) e custo no `llm_calls` (≤ R$ 0,60 por 100 cards).
6. Conferir critérios do PRD §14; o item 4 (importação sem erro e sem duplicata) é bloqueante. Verificação no AnkiDroid fica como passo manual do usuário.

---

## Status final da execução

Todas as tasks T00–T30 concluídas, mais a T31 (retenção de dados, lacuna encontrada na revisão final). Cada entrega de sub-agente foi verificada pelo gerente antes do commit.

| Verificação | Resultado |
|---|---|
| Lint e typecheck do monorepo | verdes |
| Testes unitários | 336 |
| Testes de integração (Postgres, MinIO, processos reais) | 314 |
| Suíte `.apkg` contra o Anki 25.2 real (RFC §9) | 98 — também verde no Anki 26.09.3 |
| E2E Playwright do fluxo do PRD §7 | 7 cenários |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilidades |

**Gate do `.apkg`:** o empacotador próprio passou; o fallback para genanki não foi necessário.

### Decisões tomadas durante a execução
- CSV/TSV com coluna GUID e os note types do Cardify: reimportar atualiza em vez de duplicar, mas exige que a coleção já tenha recebido um `.apkg` do Cardify (os nomes de fábrica do Anki variam por idioma).
- `mod` da nota = última edição do card no Cardify: reexportar não sobrescreve edições feitas dentro do Anki.
- Teto rígido de LLM por job = 2× a meta de R$ 0,60/100 cards (mínimo 30 centavos); a meta é acompanhada no painel `/v1/admin/metricas`.
- Assinatura cancelada ou atrasada mantém o plano até o fim do período pago; excluir a conta cancela a assinatura no provedor antes de apagar.
- Regenerar card exige conta; o fluxo anônimo fica restrito à amostra.

### Pendências que dependem de recursos externos
- **Custo e qualidade reais dos cards:** sem `ANTHROPIC_API_KEY` no ambiente de desenvolvimento. Pela tabela de preços, o Sonnet 5.5 no estágio B tende a custar ~R$ 1,00 por 100 cards, acima da meta de R$ 0,60; trocar para o Haiku 5.5 é uma variável de ambiente (`LLM_MODELO_FORTE`). Medir com material real antes de decidir.
- **Imagem Docker:** o `docker build` não completa no ambiente local (apt bloqueado); o job `imagem` da CI valida.
- **AnkiDroid:** verificação manual periódica (RFC §9).
- **MinIO de desenvolvimento** usa a imagem legada `bitnamilegacy/minio`; em produção, usar um S3 gerenciado.
