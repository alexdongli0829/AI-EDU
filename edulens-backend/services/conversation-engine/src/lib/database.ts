/**
 * Database Connection Utility for Conversation Engine
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { PrismaClient } from '@prisma/client';

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

let prismaClient: PrismaClient | null = null;
let databaseUrl: string | null = null;

async function getDatabaseUrl(): Promise<string> {
  if (databaseUrl) {
    return databaseUrl;
  }

  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable is not set');
  }

  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretArn })
    );

    if (!response.SecretString) {
      throw new Error('Secret string is empty');
    }

    const secret = JSON.parse(response.SecretString);
    const { username, password, host, port, dbname } = secret;

    if (!username || !password || !host || !port || !dbname) {
      throw new Error('Missing required database credentials in secret');
    }

    databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${dbname}?sslmode=require`;
    return databaseUrl;
  } catch (error) {
    console.error('Error fetching database credentials:', error);
    throw new Error('Failed to retrieve database credentials from Secrets Manager');
  }
}

async function initializeSchema(client: PrismaClient): Promise<void> {
  try {
    await client.$queryRaw`SELECT 1 FROM chat_sessions LIMIT 1`;
    console.log('Chat tables already initialized');
  } catch (error) {
    console.log('Chat tables not found, initializing...');

    try {
      console.log('Creating chat_sessions table...');
      await client.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL,
            student_id UUID,
            agent_type VARCHAR(50) NOT NULL,
            status VARCHAR(20) DEFAULT 'active',
            agent_state VARCHAR(30) DEFAULT 'idle',
            started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP WITH TIME ZONE
        )
      `);
      await client.$executeRawUnsafe(`
        ALTER TABLE chat_sessions
        ADD COLUMN IF NOT EXISTS agent_state VARCHAR(30) DEFAULT 'idle'
      `);

      console.log('Creating chat_messages table...');
      await client.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('Creating indexes...');
      await client.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)`);
      await client.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_chat_sessions_student_id ON chat_sessions(student_id)`);
      await client.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id)`);

      console.log('✅ Chat tables initialized successfully');
    } catch (initError) {
      console.error('❌ Chat table initialization failed:', initError);
      throw initError;
    }
  }
}

export async function getPrismaClient(): Promise<PrismaClient> {
  if (prismaClient) {
    return prismaClient;
  }

  const url = await getDatabaseUrl();

  prismaClient = new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  await initializeSchema(prismaClient);

  return prismaClient;
}

export async function disconnectDatabase(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}
