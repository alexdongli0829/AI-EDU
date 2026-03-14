# Fix Deployment Errors

## Errors Fixed

### 1. ❌ Database Secret Error
**Error**: "Could not find a value associated with JSONKey in SecretString"

**Cause**: Lambda functions tried to read `connectionString` from Aurora secret, but it doesn't exist.

**Fix**: Changed Lambda constructs to pass `DB_SECRET_ARN` instead. Lambda code must now read the secret and construct the connection string.

**Files changed**:
- `lib/constructs/nodejs-lambda.ts`
- `lib/constructs/python-lambda.ts`

### 2. ❌ Lambda Package Too Large
**Error**: "Unzipped size must be smaller than 262144000 bytes"

**Cause**: Python Lambda packages included `venv/` directory (virtual environment) which can be 200+ MB.

**Fix**:
- Added `.dockerignore` to exclude `venv/` and other unnecessary files
- Updated Python Lambda construct to explicitly exclude these files
- Updated Node.js Lambda construct to exclude test files

**Files changed**:
- `lib/constructs/python-lambda.ts` (added exclude list)
- `lib/constructs/nodejs-lambda.ts` (added exclude list)
- `edulens-backend/services/profile-engine/.dockerignore` (created)
- `edulens-backend/services/background-jobs/.dockerignore` (created)

## Steps to Redeploy

### 1. Delete Failed Stack

```bash
aws cloudformation delete-stack --stack-name EduLensLambdaStack-dev

# Wait for deletion to complete (2-3 minutes)
aws cloudformation wait stack-delete-complete --stack-name EduLensLambdaStack-dev
```

Or delete via AWS Console:
1. Go to [CloudFormation Console](https://console.aws.amazon.com/cloudformation/)
2. Select `EduLensLambdaStack-dev`
3. Click **Delete**
4. Confirm deletion

### 2. Redeploy

```bash
cd /Volumes/workplace/AI-EDU/edulens-infrastructure

# Deploy just the Lambda stack
./deploy.sh dev deploy

# Or deploy all stacks
npx cdk deploy --all --context stage=dev
```

### 3. After Deployment: Update Backend Code

Your backend Lambda functions need to be updated to read database credentials from Secrets Manager.

See **[docs/DATABASE-CONNECTION.md](./docs/DATABASE-CONNECTION.md)** for detailed examples.

**Quick example for TypeScript:**

```typescript
// src/lib/database.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient();

export async function getDatabaseUrl(): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
  );

  const creds = JSON.parse(response.SecretString!);

  return `postgresql://${creds.username}:${creds.password}@${creds.host}:${creds.port}/${creds.dbname}?sslmode=require`;
}
```

**Quick example for Python:**

```python
# src/lib/database.py
import os
import json
import boto3

secrets_client = boto3.client('secretsmanager')

def get_database_url():
    response = secrets_client.get_secret_value(SecretId=os.environ['DB_SECRET_ARN'])
    creds = json.loads(response['SecretString'])
    return f"postgresql://{creds['username']}:{creds['password']}@{creds['host']}:{creds['port']}/{creds['dbname']}?sslmode=require"
```

## Verification

After deployment, check Lambda functions:

```bash
# List Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `edulens`)].FunctionName'

# Check one function's environment variables
aws lambda get-function-configuration \
  --function-name edulens-create-test-dev \
  --query 'Environment.Variables'

# You should see DB_SECRET_ARN, not DATABASE_URL
```

## What Changed

### Before (❌ Broken)
```typescript
environment: {
  DATABASE_URL: auroraSecret.secretValueFromJson('connectionString').unsafeUnwrap(),
  // ❌ connectionString doesn't exist in Aurora secret
}
```

### After (✅ Working)
```typescript
environment: {
  DB_SECRET_ARN: auroraSecret.secretArn,
  // ✅ Lambda reads secret at runtime
}
```

## Backend Code Changes Required

All backend Lambda handlers must be updated to:

1. **Read secret from Secrets Manager** using `DB_SECRET_ARN`
2. **Construct database connection string** from secret fields
3. **Optionally cache** the credentials for performance

Example handler update:

```typescript
// Before (won't work)
import { Client } from 'pg';
const client = new Client({ connectionString: process.env.DATABASE_URL });

// After (works)
import { getDatabaseUrl } from '../lib/database';
const databaseUrl = await getDatabaseUrl();
const client = new Client({ connectionString: databaseUrl });
```

## Summary

- ✅ Fixed database secret access (pass ARN, not connection string)
- ✅ Fixed Lambda package size (exclude venv and test files)
- ✅ Created helper documentation for reading database credentials
- ✅ Ready to redeploy

**Next**: Delete failed stack → Redeploy → Update backend code
