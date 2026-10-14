import { migrar } from './migrar';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL não definida');
  await migrar(connectionString);
  console.log('migrations aplicadas');
}

main().catch((erro: unknown) => {
  console.error(erro);
  process.exitCode = 1;
});
