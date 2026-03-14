/**
 * Database Connection Utility
 *
 * Reads database credentials from AWS Secrets Manager and creates Prisma client
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { PrismaClient } from '@prisma/client';

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

let prismaClient: PrismaClient | null = null;
let databaseUrl: string | null = null;

/**
 * Get database URL from Secrets Manager
 */
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

    // Aurora creates individual fields in the secret
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

/**
 * Initialize database schema if not exists
 */
async function initializeSchema(client: PrismaClient): Promise<void> {
  try {
    // Check if users table exists
    await client.$queryRaw`SELECT 1 FROM users LIMIT 1`;
    console.log('Database schema already initialized');
  } catch (error) {
    console.log('Database schema not found, initializing...');

    try {
      // Execute each SQL statement separately
      console.log('Creating UUID extension...');
      await client.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

      console.log('Creating users table...');
      await client.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'parent', 'admin')),
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('Creating users indexes...');
      await client.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      await client.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);

      console.log('Creating students table...');
      await client.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS students (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            grade_level INTEGER NOT NULL CHECK (grade_level >= 1 AND grade_level <= 12),
            date_of_birth DATE NOT NULL,
            parent_id UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('Creating students indexes...');
      await client.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id)`);
      await client.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id)`);

      console.log('Creating update trigger function...');
      await client.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      console.log('Creating triggers...');
      await client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS update_users_updated_at ON users`);
      await client.$executeRawUnsafe(`
        CREATE TRIGGER update_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
      `);

      await client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS update_students_updated_at ON students`);
      await client.$executeRawUnsafe(`
        CREATE TRIGGER update_students_updated_at
            BEFORE UPDATE ON students
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
      `);

      console.log('✅ Database schema initialized successfully');
    } catch (initError) {
      console.error('❌ Database initialization failed:', initError);
      throw initError;
    }
  }
}

/**
 * Get or create Prisma client instance
 */
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

  // Auto-initialize schema on first connection
  await initializeSchema(prismaClient);

  return prismaClient;
}

/**
 * Health check
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Disconnect database (for cleanup)
 */
export async function disconnectDatabase(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}
