# Cardify

Gerador de flashcards com IA: PDF ou texto colado → cards revisáveis → baralho `.apkg` para o Anki.

- Produto: [`docs/PRD.md`](docs/PRD.md)
- Arquitetura: [`docs/RFC-001.md`](docs/RFC-001.md)
- Plano de execução por tasks: [`docs/PLANO.md`](docs/PLANO.md)
- Convenções: [`docs/CONVENCOES.md`](docs/CONVENCOES.md)

## Estrutura

```
apps/api      NestJS + Fastify (HTTP, SSE, webhooks)
apps/worker   NestJS sem HTTP (pipeline de geração)
apps/web      Next.js + Tailwind
libs/shared   schemas zod, contratos, constantes
libs/db       Drizzle (Postgres)
libs/ingest   PDF → linhas → limpeza → chunks
libs/generation  LLM em dois estágios, cloze, dedup, orçamento
libs/apkg     empacotador .apkg e CSV/TSV
libs/queue    pg-boss + progresso via LISTEN/NOTIFY
libs/storage  S3/MinIO
```

## Desenvolvimento

```
npm install
npm run typecheck
npm run lint
npm test            # unitários
npm run test:int    # integração (Postgres)
```
