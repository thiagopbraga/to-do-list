import './observabilidade/iniciar-telemetria';
import 'reflect-metadata';
import { Logger } from 'nestjs-pino';
import { criarApp } from './bootstrap';

async function main() {
  const app = await criarApp();
  app.useLogger(app.get(Logger));
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
}

void main();
