# Convenções do Cardify (leitura obrigatória para quem implementa uma task)

## Estrutura

- `libs/*` e `apps/api`, `apps/worker`: TypeScript compilado para CommonJS (`module: Node16`). Imports relativos **sem** extensão.
- `apps/web`: Next.js 15 (App Router) + Tailwind 4. Importa só `@cardify/shared`.
- Import entre pacotes sempre por nome (`@cardify/shared`, `@cardify/db`...), nunca por caminho relativo atravessando pacotes.
- Contratos entre pacotes: `libs/shared/src/contracts.ts`. Schemas zod, constantes e erros: `libs/shared/src/{schemas,constants,errors}.ts`.
- Dependências **somente ESM** (`pdfjs-dist`, `file-type`): carregar com `await import('...')` dinâmico.

## Nomes e estilo

- Identificadores de domínio em português, `camelCase` em TS, `snake_case` em tabelas/colunas.
- Comentários só para restrições que o código não mostra. Sem comentários narrando o que a próxima linha faz.
- Erros de domínio estendem `CardifyError` (`libs/shared/src/errors.ts`).

## Testes

- Unitários: `src/**/*.test.ts`, sem rede e sem banco. Rodar: `npx vitest run --project unit <caminho>`.
- Integração: `src/**/*.int.test.ts` (Postgres, MinIO, processos). Rodar: `npx vitest run --project int <caminho>`.
- Banco de teste: `DATABASE_URL_TEST`, padrão `postgres://postgres:postgres@localhost:5432/cardify_test`.
- `describe/it/expect` são globais (vitest `globals: true`).

## Comandos de verificação (na pasta `cardify/`)

```
npx tsc -p tsconfig.json --noEmit     # typecheck de libs + api + worker (inclui testes)
npx eslint <pastas da task>
npx vitest run --project unit <pastas da task>
```

## Regras para sub-agentes

1. Altere **somente** os arquivos/pastas listados na sua task.
2. **Não** rode `npm install`/`npm i` e não edite `package.json` nem `package-lock.json`. Se faltar dependência, pare e reporte.
3. **Não** mude assinaturas de `libs/shared/src/contracts.ts` nem dos stubs já existentes. Se for inevitável, reporte com a justificativa.
4. **Não** faça commit nem push. O gerente revisa e commita.
5. Substitua o `naoImplementado('Txx')` da sua task por implementação real; deixe intactos os stubs de outras tasks.
6. Ao terminar, devolva: arquivos alterados, saída dos comandos de verificação, desvios da especificação e dúvidas.
