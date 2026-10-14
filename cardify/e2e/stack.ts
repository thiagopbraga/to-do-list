/**
 * Supervisor da stack de E2E: build (opcional), banco/bucket do zero, API, worker e web.
 * É o único `webServer` do Playwright; ele precisa subir tudo na ordem certa e morrer junto
 * com o Playwright, sem deixar processo órfão nas portas 3100/4100.
 */
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ENV_STACK, PORTA_WEB, RAIZ, URL_API, URL_WEB } from './ambiente';
import { prepararBanco, prepararBucket } from './infra';

const PASTA_LOGS = path.join(__dirname, '.logs');
const filhos: ChildProcess[] = [];
let encerrando = false;

const env = { ...process.env, ...ENV_STACK };
// O Next não aceita NODE_ENV=development em `build`/`start` (falha ao pré-renderizar /404): ele define o seu próprio.
const { NODE_ENV: _ignorado, ...envWeb } = env;

function log(mensagem: string): void {
  process.stdout.write(`[stack] ${mensagem}\n`);
}

function encerrarTudo(codigo: number): never {
  if (!encerrando) {
    encerrando = true;
    for (const filho of filhos) {
      if (filho.pid && filho.exitCode === null) {
        try {
          process.kill(-filho.pid, 'SIGTERM');
        } catch {
          filho.kill('SIGTERM');
        }
      }
    }
  }
  setTimeout(() => process.exit(codigo), 1500).unref();
  // Mantém o event loop vivo até o timeout acima.
  return undefined as never;
}

function executarBuild(rotulo: string, comando: string, args: string[], cwd: string, envBuild = env): void {
  log(`build: ${rotulo}`);
  const arquivo = path.join(PASTA_LOGS, `build-${rotulo}.log`);
  const saida = fs.openSync(arquivo, 'w');
  const resultado = spawnSync(comando, args, { cwd, env: envBuild, stdio: ['ignore', saida, saida] });
  fs.closeSync(saida);
  if (resultado.status !== 0) {
    const cauda = fs.readFileSync(arquivo, 'utf8').split('\n').slice(-40).join('\n');
    throw new Error(`build ${rotulo} falhou (log em ${arquivo}):\n${cauda}`);
  }
}

function iniciar(nome: string, comando: string, args: string[], cwd: string, envProcesso = env): ChildProcess {
  const saida = fs.openSync(path.join(PASTA_LOGS, `${nome}.log`), 'w');
  const filho = spawn(comando, args, {
    cwd,
    env: envProcesso,
    stdio: ['ignore', saida, saida],
    detached: true,
  });
  filhos.push(filho);
  filho.on('exit', (codigo, sinal) => {
    if (encerrando) return;
    log(`${nome} saiu inesperadamente (codigo=${codigo}, sinal=${sinal}); veja e2e/.logs/${nome}.log`);
    encerrarTudo(1);
  });
  return filho;
}

async function esperar(descricao: string, verificar: () => Promise<boolean>, limiteMs = 60_000): Promise<void> {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    if (await verificar().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timeout esperando ${descricao}`);
}

const responde = (url: string) => async () => (await fetch(url)).ok;

async function main(): Promise<void> {
  fs.mkdirSync(PASTA_LOGS, { recursive: true });

  if (process.env.E2E_SKIP_BUILD !== '1') {
    executarBuild('servidor', 'npx', ['tsc', '-b', 'tsconfig.build.json'], RAIZ);
    // As reescritas /v1/* do Next são fixadas em tempo de build: API_URL precisa apontar para a API do E2E.
    executarBuild('web', 'npx', ['next', 'build'], path.join(RAIZ, 'apps/web'), envWeb);
  }

  log('preparando banco e bucket');
  await prepararBanco();
  await prepararBucket();

  log('subindo API');
  iniciar('api', process.execPath, ['apps/api/dist/main.js'], RAIZ);
  await esperar('a API', responde(`${URL_API}/v1/health`));

  log('subindo worker');
  // LOG_LEVEL=info: a linha de módulos inicializados é o único sinal de que o worker subiu.
  iniciar('worker', process.execPath, ['apps/worker/dist/main.js'], RAIZ, { ...env, LOG_LEVEL: 'info' });
  await esperar('o worker', async () =>
    fs.readFileSync(path.join(PASTA_LOGS, 'worker.log'), 'utf8').includes('WorkerModule dependencies initialized'),
  );
  await new Promise((r) => setTimeout(r, 2000));

  log('subindo web');
  iniciar('web', process.execPath, [require.resolve('next/dist/bin/next', { paths: [path.join(RAIZ, 'apps/web')] }), 'start', '-p', String(PORTA_WEB)], path.join(RAIZ, 'apps/web'), envWeb);
  await esperar('o web', responde(`${URL_WEB}/v1/health`));

  log('stack pronta');
}

for (const sinal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) process.on(sinal, () => encerrarTudo(0));
process.on('exit', () => {
  for (const filho of filhos) {
    if (filho.pid && filho.exitCode === null) {
      try {
        process.kill(-filho.pid, 'SIGKILL');
      } catch {
        // já encerrado
      }
    }
  }
});

main().then(
  () => setInterval(() => undefined, 1 << 30),
  (erro: unknown) => {
    process.stderr.write(`[stack] ${erro instanceof Error ? erro.message : String(erro)}\n`);
    encerrarTudo(1);
  },
);
