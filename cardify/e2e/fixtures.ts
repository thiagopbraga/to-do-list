import { test as base } from '@playwright/test';
import { limparDados } from './helpers/db';

export { expect } from '@playwright/test';

/** Cada teste começa com o banco de domínio vazio: dados próprios, sem depender de ordem. */
export const test = base.extend<{ banco: void }>({
  banco: [
    // O Playwright exige desestruturação no primeiro argumento, mesmo vazia.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await limparDados();
      await use();
    },
    { auto: true },
  ],
});
