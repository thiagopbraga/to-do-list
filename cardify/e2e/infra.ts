import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { Client } from 'pg';
import {
  NOME_BANCO,
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_SECRET_ACCESS_KEY,
  URL_BANCO,
  URL_BANCO_ADMIN,
} from './ambiente';

export function clienteS3(): S3Client {
  return new S3Client({
    endpoint: S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  });
}

/** Cria o banco `cardify_e2e` se faltar e recria os schemas, aplicando as migrations do zero. */
export async function prepararBanco(): Promise<void> {
  const admin = new Client({ connectionString: URL_BANCO_ADMIN });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [NOME_BANCO]);
    if (!rowCount) await admin.query(`CREATE DATABASE ${NOME_BANCO}`);
  } finally {
    await admin.end();
  }

  const cliente = new Client({ connectionString: URL_BANCO });
  await cliente.connect();
  try {
    await cliente.query('DROP SCHEMA IF EXISTS pgboss CASCADE');
    await cliente.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await cliente.query('DROP SCHEMA IF EXISTS public CASCADE');
    await cliente.query('CREATE SCHEMA public');
  } finally {
    await cliente.end();
  }

  // Import dinâmico: @cardify/db só existe compilado depois do build do globalSetup/stack.
  const { migrar } = (await import('@cardify/db')) as { migrar(url: string): Promise<void> };
  await migrar(URL_BANCO);
}

/** Cria o bucket `cardify-e2e` se faltar e esvazia o conteúdo de execuções anteriores. */
export async function prepararBucket(): Promise<void> {
  const s3 = clienteS3();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
  }
  let token: string | undefined;
  do {
    const lista = await s3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, ContinuationToken: token }));
    const objetos = (lista.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (objetos.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: S3_BUCKET, Delete: { Objects: objetos } }));
    }
    token = lista.IsTruncated ? lista.NextContinuationToken : undefined;
  } while (token);
  s3.destroy();
}
