/**
 * Database Connection (PostgreSQL via Prisma)
 */

import { PrismaClient } from '@prisma/client';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let cachedPrisma: PrismaClient | null = null;
let cachedDatabaseUrl: string | null = null;

interface DatabaseSecret {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

async function getDatabaseUrl(): Promise<string> {
  if (cachedDatabaseUrl) {
    return cachedDatabaseUrl;
  }

  // Check for environment override first
  if (process.env.DATABASE_URL) {
    cachedDatabaseUrl = process.env.DATABASE_URL;
    return cachedDatabaseUrl;
  }

  try {
    const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const command = new GetSecretValueCommand({
      SecretId: process.env.DB_SECRET_ARN || 'edulens-aurora-secret',
    });
    
    const response = await secretsManager.send(command);
    const secret: DatabaseSecret = JSON.parse(response.SecretString || '{}');

    cachedDatabaseUrl = `postgresql://${secret.username}:${secret.password}@${secret.host}:${secret.port}/${secret.dbname}`;
    return cachedDatabaseUrl;
  } catch (error) {
    console.error('Failed to retrieve database secret:', error);
    throw new Error('Database connection failed');
  }
}

export async function getPrismaClient(): Promise<PrismaClient> {
  if (cachedPrisma) {
    return cachedPrisma;
  }

  const databaseUrl = await getDatabaseUrl();

  cachedPrisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  // Test connection and auto-initialize schema
  try {
    // Create tables if they don't exist
    await cachedPrisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        subject VARCHAR(50) NOT NULL,
        grade_level INTEGER NOT NULL,
        time_limit INTEGER NOT NULL, -- in minutes
        question_count INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await cachedPrisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
        question_type VARCHAR(50) NOT NULL, -- 'multiple_choice', 'short_answer', 'essay'
        subject VARCHAR(50) NOT NULL,
        question_text TEXT NOT NULL,
        options JSONB, -- For multiple choice questions
        correct_answer TEXT NOT NULL,
        skill_tags TEXT[], -- Array of skill identifiers
        difficulty_level INTEGER NOT NULL, -- 1-5 scale
        order_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await cachedPrisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS test_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
        student_id UUID NOT NULL, -- References students table from auth service
        status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'paused'
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        time_remaining INTEGER, -- in seconds
        current_question_index INTEGER DEFAULT 0,
        estimated_ability DECIMAL(5,2) DEFAULT 0.0, -- IRT theta estimate
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await cachedPrisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS test_answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE,
        question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
        answer TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        time_spent INTEGER NOT NULL, -- in seconds
        answered_at TIMESTAMP DEFAULT NOW(),
        confidence_level INTEGER, -- 1-5 scale (optional)
        item_difficulty DECIMAL(5,2), -- IRT difficulty at time of answer
        discrimination DECIMAL(5,2), -- IRT discrimination parameter
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Create indices for performance (one per statement — PG prepared statements disallow multi-command)
    await cachedPrisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_questions_test_id ON questions(test_id)`;
    await cachedPrisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty_level)`;
    await cachedPrisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_test_sessions_student ON test_sessions(student_id)`;
    await cachedPrisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_test_sessions_status ON test_sessions(status)`;
    await cachedPrisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_test_answers_session ON test_answers(session_id)`;
    await cachedPrisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_test_answers_question ON test_answers(question_id)`;

    console.log('Test Engine database schema initialized successfully');
  } catch (error) {
    console.error('Database schema initialization failed:', error);
  }

  return cachedPrisma;
}