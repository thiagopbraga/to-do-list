# TST-T01 — Setup do ambiente de testes

> **Spec:** [Testes Gerais](../testes-gerais.md)
> **Requisitos:** TST-01, TST-NF-02
> **Dependências:** FND-T01

## Objetivo

Configurar a stack de testes do projeto (unitário/componente + E2E) com scripts
e ambiente determinístico.

## Passos

1. Instalar e configurar **Vitest** + **@testing-library/react** + **@testing-library/jest-dom**.
2. Configurar ambiente DOM (`jsdom` ou `happy-dom`) no `vitest.config`.
3. Instalar e configurar **Playwright** (browsers + `playwright.config`).
4. Adicionar scripts ao `package.json`: `test`, `test:watch`, `test:e2e`, `coverage`.
5. Criar helpers de teste: mock de `localStorage`, controle de tempo (`vi.useFakeTimers`), factory de `Note`.

## Critérios de Verificação (DoD)

- [ ] `npm run test` executa um teste de exemplo verde.
- [ ] `npm run test:e2e` sobe o app e executa um E2E de smoke.
- [ ] Helpers de mock/tempo disponíveis e reutilizáveis.

## Arquivos afetados (estimado)

`package.json`, `vitest.config.ts`, `playwright.config.ts`, `src/test/setup.ts`, `src/test/factories.ts`
