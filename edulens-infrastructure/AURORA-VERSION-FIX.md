# Aurora PostgreSQL Version Fix

## Issue
Aurora PostgreSQL version 15.5 is not available in your AWS region.

## Available Versions
15.8, 15.10, 15.12, 15.13, 15.14, 15.15

## Fix Applied
Updated `lib/stacks/database-stack.ts` to use version 15.8.

## If Deployment Still Fails

If CDK doesn't recognize the version constant, try one of these alternatives:

### Option 1: Use Latest Version (15.15)

Edit `lib/stacks/database-stack.ts` line 51-53:

```typescript
engine: rds.DatabaseClusterEngine.auroraPostgres({
  version: rds.AuroraPostgresEngineVersion.of('15.15', '15.15'),
}),
```

### Option 2: Use Version 15.8

```typescript
engine: rds.DatabaseClusterEngine.auroraPostgres({
  version: rds.AuroraPostgresEngineVersion.of('15.8', '15.8'),
}),
```

### Option 3: Check CDK Supported Versions

Run this to see what versions CDK has constants for:

```bash
node -e "const cdk = require('aws-cdk-lib/aws-rds'); console.log(Object.keys(cdk.AuroraPostgresEngineVersion).filter(k => k.startsWith('VER_15')))"
```

Common CDK versions:
- `VER_15_2`
- `VER_15_3`
- `VER_15_4`
- `VER_15_5`
- `VER_15_6`
- `VER_15_7`

If your CDK version is older, it might not have constants for newer versions.

### Option 4: Use the of() Method (Recommended)

This works with any version available in your region:

```typescript
// Using version 15.15 (latest)
version: rds.AuroraPostgresEngineVersion.of('15.15', '15.15')

// Or version 15.14
version: rds.AuroraPostgresEngineVersion.of('15.14', '15.14')

// Or version 15.12
version: rds.AuroraPostgresEngineVersion.of('15.12', '15.12')
```

The first parameter is the version number, the second is the major version.

## Deploy After Fix

```bash
cd /Volumes/workplace/AI-EDU/edulens-infrastructure
./deploy.sh dev deploy
```

## Verify Available Versions in Your Region

```bash
aws rds describe-db-engine-versions \
  --engine aurora-postgresql \
  --query 'DBEngineVersions[?contains(EngineVersion, `15.`) == `true`].EngineVersion' \
  --output text
```

## Note About Serverless v2

Aurora Serverless v2 requires:
- PostgreSQL 13.6+ or 14.3+ or 15.2+
- All versions listed (15.8-15.15) support Serverless v2 ✅

## Upgrade Path (Future)

When you want to upgrade PostgreSQL version:

```bash
# 1. Create a snapshot (production)
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier edulens-aurora-dev \
  --db-cluster-snapshot-identifier edulens-before-upgrade

# 2. Update version in database-stack.ts
version: rds.AuroraPostgresEngineVersion.of('15.15', '15.15')

# 3. Deploy
./deploy.sh dev deploy

# Aurora will perform rolling upgrade automatically
```
