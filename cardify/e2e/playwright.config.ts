import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { URL_WEB } from './ambiente';

/**
 * O Chromium instalado em /opt/pw-browsers (r1194) é mais antigo que o esperado pelo Playwright 1.60;
 * `E2E_CHROMIUM` (ou o caminho padrão abaixo, se existir) evita depender de `playwright install`.
 */
const CHROMIUM_PADRAO = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.E2E_CHROMIUM ?? (fs.existsSync(CHROMIUM_PADRAO) ? CHROMIUM_PADRAO : undefined);

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  outputDir: path.join(__dirname, 'test-results'),
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(__dirname, 'playwright-report') }]],
  use: {
    baseURL: URL_WEB,
    trace: 'retain-on-failure',
    acceptDownloads: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npx tsx e2e/stack.ts',
    cwd: path.join(__dirname, '..'),
    url: `${URL_WEB}/v1/health`,
    timeout: 600_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
