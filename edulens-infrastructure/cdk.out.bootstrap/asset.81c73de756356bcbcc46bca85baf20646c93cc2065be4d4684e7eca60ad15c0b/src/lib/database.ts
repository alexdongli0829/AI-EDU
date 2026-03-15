import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { PrismaClient } from '@prisma/client';

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-west-2',
});

let prismaClient: PrismaClient | null = null;
let databaseUrl: string | null = null;

async function getDatabaseUrl(): Promise<string> {
  if (databaseUrl) return databaseUrl;

  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) throw new Error('DB_SECRET_ARN environment variable is not set');

  const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!response.SecretString) throw new Error('Secret string is empty');

  const { username, password, host, port, dbname } = JSON.parse(response.SecretString);
  databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${dbname}?sslmode=require`;
  return databaseUrl;
}

export async function getPrismaClient(): Promise<PrismaClient> {
  if (prismaClient) return prismaClient;

  const url = await getDatabaseUrl();
  prismaClient = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
  return prismaClient;
}
