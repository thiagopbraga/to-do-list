# E2E (Playwright)

Fluxo principal do Cardify contra a stack real: API, worker e web, com Postgres e MinIO locais e os providers `fake` (LLM e pagamento).

```
npm run test:e2e                      # builda, recria banco/bucket, sobe a stack, roda e derruba tudo
E2E_SKIP_BUILD=1 npm run test:e2e     # reaproveita dist/ e .next/ da execução anterior (mais rápido)
```

## Pré-requisitos

- Postgres em `localhost:5432` (`postgres`/`postgres`) e MinIO em `localhost:9000` (`minioadmin`/`minioadmin`).
- `bash tools/anki/preparar.sh` já executado (a exportação `.apkg` é validada com o importador oficial do Anki).
- Chromium: o Playwright 1.60 espera a revisão r1223; o ambiente tem a r1194 em `/opt/pw-browsers`. A config usa
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` se existir, ou o caminho de `E2E_CHROMIUM`. Não rode `playwright install`.

## Como a stack sobe

O único `webServer` do Playwright é `e2e/stack.ts` (supervisor), porque o Playwright sobe o `webServer` **antes** do
`globalSetup` e a ordem aqui importa: build, banco/bucket, API, worker, web. Ele:

1. `E2E_SKIP_BUILD != 1`: `npx tsc -b tsconfig.build.json` e `npx next build` em `apps/web`. O build do web roda com
   `API_URL=http://localhost:4100` porque o Next fixa as reescritas `/v1/*` em tempo de build; ele **sobrescreve `apps/web/.next`**.
   `NODE_ENV` é removido do ambiente do Next (com `development` o `next build` falha ao pré-renderizar `/404`).
2. Cria o banco `cardify_e2e` (se faltar), recria os schemas `public`, `drizzle` e `pgboss` e aplica as migrations (`migrar` de `@cardify/db`);
   cria/esvazia o bucket `cardify-e2e`.
3. Sobe a API (porta 4100), o worker e o web (`next start`, porta 3100), cada um em seu grupo de processos, com logs em `e2e/.logs/`.
4. Ao receber SIGTERM do Playwright (ou se qualquer filho morrer), encerra todos. Nada fica ouvindo nas portas 3100/4100.

O `globalSetup` (`global-setup.ts`) só confere que API e web respondem e que o venv do Anki existe. Cada teste começa com as tabelas de
domínio truncadas (fixture automática em `fixtures.ts`), então os cenários não dependem de ordem; o schema `pgboss` não é tocado.

## Env da stack

Definido em `ambiente.ts`: `DATABASE_URL=.../cardify_e2e`, `S3_*` (bucket `cardify-e2e`), `APP_URL=http://localhost:3100`,
`API_URL=http://localhost:4100`, `PORT=4100`, `LLM_PROVIDER=fake`, `PAGAMENTO_PROVIDER=fake`, `ANON_TETO_DIARIO_CENTAVOS=100000000`.

## Login sem e-mail

`helpers/auth.ts` grava em `magic_links` uma linha com `token_hash = sha256(token)` e abre
`http://localhost:4100/v1/auth/email/verificar?token=...&retorno=...`. Isso exercita a verificação real, a criação da sessão e o vínculo do
trabalho anônimo (cookie `cardify_anon`).

## Cenários

| Arquivo | O que cobre |
|---|---|
| `tests/01-fluxo-principal.spec.ts` | PRD §7: amostra anônima, login, vínculo do job, baralho completo, edição, descarte, exportação `.apkg` e importação no Anki (notas = cards ativos, frente editada presente, descartado ausente). Duas variantes: `colado.txt` completo e os 6 primeiros parágrafos (um chunk só). |
| `tests/02-paywall-pix.spec.ts` | Essencial com Pix fake: QR e copia e cola, webhook simulado, polling, `/conta` com plano e cota de 1.500. |
| `tests/03-upload-pdf.spec.ts` | Upload direto ao MinIO pela URL assinada, geração e seções na revisão. |
| `tests/04-erros-visiveis.spec.ts` | PDF escaneado e texto com menos de 50 caracteres. |
| `tests/05-exclusao-de-conta.spec.ts` | Exclusão com `EXCLUIR`, volta deslogada, usuário removido do banco. |

## Depuração

- Traces das falhas: `npx playwright show-trace e2e/test-results/<teste>/trace.zip`; relatório HTML em `e2e/playwright-report/`.
- Logs da stack: `e2e/.logs/{api,worker,web}.log` e `build-*.log`.
