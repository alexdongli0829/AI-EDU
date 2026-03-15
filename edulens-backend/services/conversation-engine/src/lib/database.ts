import postgres from 'postgres';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let _sql: postgres.Sql | null = null;
let _url: string | null = null;

async function getDatabaseUrl(): Promise<string> {
  if (_url) return _url;
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) throw new Error('DB_SECRET_ARN is not set');
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-west-2' });
  const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!SecretString) throw new Error('Empty secret');
  const { username, password, host, port, dbname } = JSON.parse(SecretString);
  _url = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbname}?sslmode=require`;
  return _url;
}

export async function getDb(): Promise<postgres.Sql> {
  if (_sql) return _sql;
  const url = await getDatabaseUrl();
  _sql = postgres(url, { max: 1, idle_timeout: 20, max_lifetime: 1800 });
  return _sql;
}

/**
 * Drop-in replacement for Prisma's $queryRawUnsafe / $executeRawUnsafe.
 * Accepts spread params just like Prisma did.
 */
export async function query<T = any>(sql: string, ...params: any[]): Promise<T[]> {
  const db = await getDb();
  return db.unsafe<T[]>(sql, params.length > 0 ? params : []);
}
