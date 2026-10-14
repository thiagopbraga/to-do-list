import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const libs = ['shared', 'db', 'ingest', 'generation', 'apkg', 'queue', 'storage'];
const alias = Object.fromEntries(
  libs.map((lib) => [`@cardify/${lib}`, fileURLToPath(new URL(`./libs/${lib}/src/index.ts`, import.meta.url))]),
);

const comum = {
  globals: true,
  environment: 'node' as const,
  alias,
};

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    projects: [
      {
        plugins: [swc.vite({ module: { type: 'es6' } })],
        test: {
          ...comum,
          name: 'unit',
          include: ['libs/*/src/**/*.test.ts', 'apps/{api,worker}/src/**/*.test.ts', 'tools/**/*.test.ts'],
          exclude: ['**/*.int.test.ts', '**/node_modules/**', '**/dist/**'],
        },
      },
      {
        plugins: [swc.vite({ module: { type: 'es6' } })],
        test: {
          ...comum,
          name: 'int',
          include: ['libs/*/src/**/*.int.test.ts', 'apps/{api,worker}/src/**/*.int.test.ts', 'tools/**/*.int.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
