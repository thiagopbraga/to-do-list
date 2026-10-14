import fs from 'node:fs';
import { PYTHON_ANKI, URL_API, URL_WEB } from './ambiente';
import { clienteS3 } from './infra';

/** A stack (banco, bucket, API, worker e web) já foi preparada por `stack.ts`; aqui só se confere o ambiente. */
export default async function globalSetup(): Promise<void> {
  for (const [nome, url] of [
    ['API', `${URL_API}/v1/health`],
    ['web', `${URL_WEB}/v1/health`],
  ] as const) {
    const resposta = await fetch(url).catch(() => null);
    if (!resposta?.ok) throw new Error(`${nome} não respondeu em ${url}`);
  }
  if (!fs.existsSync(PYTHON_ANKI)) {
    throw new Error(`venv do Anki ausente em ${PYTHON_ANKI}; rode: bash tools/anki/preparar.sh`);
  }
  clienteS3().destroy();
}
