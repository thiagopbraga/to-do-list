import 'reflect-metadata';
import { criarApp } from './bootstrap';

async function main() {
  const app = await criarApp();
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
}

void main();
