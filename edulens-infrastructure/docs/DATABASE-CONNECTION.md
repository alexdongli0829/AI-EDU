# Database Connection Guide for Lambda Functions

## Overview

Lambda functions receive the database secret ARN via environment variable, not a connection string. This is more secure and flexible.

## Environment Variables

Each Lambda function receives:

```bash
DB_SECRET_ARN=arn:aws:secretsmanager:us-west-2:123456789012:secret:edulens-db-credentials-dev-AbCdEf
REDIS_URL=redis://edulens-redis-dev.cache.amazonaws.com:6379
```

## Reading Database Credentials

### TypeScript/Node.js Lambda Functions

Install AWS SDK:
```bash
npm install @aws-sdk/client-secrets-manager
```

**Helper function to read database credentials:**

```typescript
// src/lib/database.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface DatabaseCredentials {
  username: string;
  password: string;
  engine: string;
  host: string;
  port: number;
  dbname: string;
  dbClusterIdentifier?: string;
}

const secretsClient = new SecretsManagerClient();

export async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  const secretArn = process.env.DB_SECRET_ARN;

  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable not set');
  }

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  return JSON.parse(response.SecretString) as DatabaseCredentials;
}

export async function getDatabaseUrl(): Promise<string> {
  const creds = await getDatabaseCredentials();

  // PostgreSQL connection string format
  return `postgresql://${creds.username}:${creds.password}@${creds.host}:${creds.port}/${creds.dbname}?sslmode=require`;
}
```

**Usage in Lambda handler:**

```typescript
// src/handlers/example.ts
import { getDatabaseUrl } from '../lib/database';
import { Client } from 'pg'; // or your ORM

export async function handler(event: any) {
  // Get database URL
  const databaseUrl = await getDatabaseUrl();

  // Connect to database
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Your database operations
    const result = await client.query('SELECT * FROM users LIMIT 1');

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows),
    };
  } finally {
    await client.end();
  }
}
```

**With Prisma ORM:**

```typescript
// src/lib/database.ts
import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from './credentials';

let prisma: PrismaClient;

export async function getPrismaClient(): Promise<PrismaClient> {
  if (!prisma) {
    const databaseUrl = await getDatabaseUrl();
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }
  return prisma;
}

// Usage
const prisma = await getPrismaClient();
const users = await prisma.user.findMany();
```

**With Connection Pooling (Recommended):**

```typescript
// src/lib/database.ts
import { Pool } from 'pg';
import { getDatabaseCredentials } from './credentials';

let pool: Pool;

export async function getPool(): Promise<Pool> {
  if (!pool) {
    const creds = await getDatabaseCredentials();

    pool = new Pool({
      user: creds.username,
      password: creds.password,
      host: creds.host,
      port: creds.port,
      database: creds.dbname,
      ssl: { rejectUnauthorized: false },
      max: 2, // Lambda: Keep connections low
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

// Usage in handler
export async function handler(event: any) {
  const pool = await getPool();
  const result = await pool.query('SELECT * FROM users');
  return { statusCode: 200, body: JSON.stringify(result.rows) };
}
```

### Python Lambda Functions

Install boto3:
```bash
pip install boto3
```

**Helper function to read database credentials:**

```python
# src/lib/database.py
import os
import json
import boto3
from typing import Dict, Any

secrets_client = boto3.client('secretsmanager')

def get_database_credentials() -> Dict[str, Any]:
    """Get database credentials from Secrets Manager"""
    secret_arn = os.environ.get('DB_SECRET_ARN')

    if not secret_arn:
        raise ValueError('DB_SECRET_ARN environment variable not set')

    response = secrets_client.get_secret_value(SecretId=secret_arn)
    return json.loads(response['SecretString'])

def get_database_url() -> str:
    """Get PostgreSQL connection URL"""
    creds = get_database_credentials()

    return (
        f"postgresql://{creds['username']}:{creds['password']}"
        f"@{creds['host']}:{creds['port']}/{creds['dbname']}"
        f"?sslmode=require"
    )
```

**Usage in Lambda handler:**

```python
# src/handlers/example.py
import psycopg2
from lib.database import get_database_url

def handler(event, context):
    # Get database URL
    database_url = get_database_url()

    # Connect to database
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    try:
        # Your database operations
        cur.execute('SELECT * FROM users LIMIT 1')
        result = cur.fetchall()

        return {
            'statusCode': 200,
            'body': json.dumps({'users': result})
        }
    finally:
        cur.close()
        conn.close()
```

**With SQLAlchemy:**

```python
# src/lib/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from lib.credentials import get_database_url

_engine = None
_SessionLocal = None

def get_db_session():
    """Get SQLAlchemy session"""
    global _engine, _SessionLocal

    if _engine is None:
        database_url = get_database_url()
        _engine = create_engine(
            database_url,
            pool_size=2,  # Lambda: Keep connections low
            max_overflow=0,
            pool_pre_ping=True,
        )
        _SessionLocal = sessionmaker(bind=_engine)

    return _SessionLocal()

# Usage
def handler(event, context):
    db = get_db_session()
    try:
        users = db.query(User).all()
        return {'statusCode': 200, 'body': json.dumps([u.dict() for u in users])}
    finally:
        db.close()
```

## Secret Structure

Aurora creates a secret with this structure:

```json
{
  "username": "postgres",
  "password": "generated-password",
  "engine": "postgres",
  "host": "edulens-aurora-dev.cluster-xxxxx.us-west-2.rds.amazonaws.com",
  "port": 5432,
  "dbname": "edulens",
  "dbClusterIdentifier": "edulens-aurora-dev"
}
```

## Caching Credentials

For better performance, cache the credentials:

```typescript
// TypeScript
let cachedCredentials: DatabaseCredentials | null = null;

export async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  // Fetch from Secrets Manager
  cachedCredentials = await fetchFromSecretsManager();
  return cachedCredentials;
}
```

```python
# Python
_cached_credentials = None

def get_database_credentials():
    global _cached_credentials
    if _cached_credentials is not None:
        return _cached_credentials

    # Fetch from Secrets Manager
    _cached_credentials = fetch_from_secrets_manager()
    return _cached_credentials
```

**Note**: Lambda containers are reused, so caching works across invocations.

## IAM Permissions

Lambda functions already have permission to read the secret (configured in CDK):

```typescript
// Already configured in lambda-stack.ts
const secretReadPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    'secretsmanager:GetSecretValue',
    'secretsmanager:DescribeSecret',
  ],
  resources: [auroraSecret.secretArn],
});
```

## Connection Best Practices

### 1. Use Connection Pooling

```typescript
// Create pool outside handler (reused across invocations)
const pool = new Pool({ /* config */ });

export async function handler(event: any) {
  // Use pool
  const result = await pool.query('SELECT ...');
}
```

### 2. Keep Lambda Warm

For critical paths, use provisioned concurrency to keep connections warm.

### 3. Limit Connections

Aurora Serverless v2 with 0.5 ACU ≈ 50 connections max. Keep Lambda pool size low (2-5).

### 4. Handle Connection Errors

```typescript
import { getDatabaseUrl } from './database';

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const result = await executeWithRetry(() =>
  pool.query('SELECT * FROM users')
);
```

## Testing Locally

Set environment variable:

```bash
# .env.local
DB_SECRET_ARN=arn:aws:secretsmanager:us-west-2:123456789012:secret:edulens-db-credentials-dev-AbCdEf

# Or for local development
DATABASE_URL=postgresql://postgres:password@localhost:5432/edulens_dev
```

In code:

```typescript
const databaseUrl = process.env.DATABASE_URL || await getDatabaseUrl();
```

## Troubleshooting

### Error: "Could not find a value associated with JSONKey in SecretString"

✅ **Fixed!** This was the old code trying to access a non-existent `connectionString` field.

### Error: "Unable to connect to database"

Check:
1. Lambda is in VPC private subnets
2. Security group allows outbound to Aurora (port 5432)
3. Aurora security group allows inbound from Lambda security group

### Error: "Secret not found"

Verify:
```bash
aws secretsmanager get-secret-value --secret-id $DB_SECRET_ARN
```

### Connection Timeout

Aurora Serverless v2 might be paused. First connection takes ~10-15 seconds to wake up.

## Migration from Old Code

**Old (❌ Won't work):**
```typescript
const databaseUrl = process.env.DATABASE_URL;
```

**New (✅ Works):**
```typescript
import { getDatabaseUrl } from './lib/database';
const databaseUrl = await getDatabaseUrl();
```

## Summary

- ✅ Lambda receives `DB_SECRET_ARN` environment variable
- ✅ Lambda reads secret from Secrets Manager at runtime
- ✅ Construct connection string in Lambda code
- ✅ Cache credentials for performance
- ✅ Use connection pooling
- ✅ IAM permissions already configured
