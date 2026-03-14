# EduLens Infrastructure (AWS CDK)

AWS Cloud Development Kit (CDK) infrastructure for deploying the EduLens educational platform.

## 🚀 Quick Deploy

```bash
# 1. Configure AWS credentials
aws configure

# 2. Update your account ID in config/environments.ts (line 43)

# 3. Deploy everything
./deploy.sh dev deploy
```

**📖 For detailed instructions, see [QUICKSTART.md](./QUICKSTART.md) or [DEPLOYMENT.md](./DEPLOYMENT.md)**

## Overview

This CDK application deploys a complete serverless architecture on AWS including:

- **Network**: VPC with public/private/isolated subnets, NAT Gateway, Security Groups
- **Database**: RDS Aurora Serverless v2 (PostgreSQL), ElastiCache Redis, DynamoDB
- **API**: API Gateway (REST + WebSocket), Application Load Balancer (SSE streaming)
- **Compute**: AWS Lambda functions (24 Lambda functions across 6 microservices)
- **Jobs**: SQS queues, EventBridge rules for async processing
- **Monitoring**: CloudWatch Logs, Metrics, Alarms, X-Ray tracing
- **AI**: AWS Bedrock integration (Claude models)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
        ┌──────▼──────┐          ┌───────▼────────┐
        │ API Gateway │          │      ALB       │
        │ (REST + WS) │          │  (SSE Stream)  │
        └──────┬──────┘          └───────┬────────┘
               │                          │
    ┌──────────┴──────────────────────────┴──────────┐
    │                  VPC                            │
    │  ┌────────────────────────────────────────┐    │
    │  │         Private Subnets                │    │
    │  │  ┌─────────────────────────────────┐   │    │
    │  │  │   Lambda Functions (6 services) │   │    │
    │  │  │  - Test Engine (Node.js)        │   │    │
    │  │  │  - Conversation Engine (Node.js)│   │    │
    │  │  │  - Profile Engine (Python)      │   │    │
    │  │  │  - Background Jobs (Python)     │   │    │
    │  │  │  - Admin Service (Node.js)      │   │    │
    │  │  └─────────────┬───────────────────┘   │    │
    │  │                │                        │    │
    │  └────────────────┼────────────────────────┘    │
    │                   │                             │
    │  ┌────────────────▼────────────────────────┐    │
    │  │         Isolated Subnets                │    │
    │  │  ┌──────────────┐  ┌─────────────────┐ │    │
    │  │  │ RDS Aurora   │  │ ElastiCache     │ │    │
    │  │  │ Serverless v2│  │ Redis           │ │    │
    │  │  └──────────────┘  └─────────────────┘ │    │
    │  └─────────────────────────────────────────┘    │
    └─────────────────────────────────────────────────┘

         ┌──────────────┐           ┌──────────────┐
         │  DynamoDB    │           │  SQS Queues  │
         │  (WebSocket) │           │  EventBridge │
         └──────────────┘           └──────────────┘
```

## Prerequisites

- **Node.js**: 20.x or later
- **AWS CDK**: 2.133.0 or later (`npm install -g aws-cdk`)
- **AWS CLI**: Configured with credentials
- **AWS Account**: With appropriate permissions
- **AWS Bedrock**: Model access enabled for Claude 3.5 Sonnet and Haiku

## Project Structure

```
edulens-infrastructure/
├── bin/
│   └── app.ts                    # CDK app entry point
├── lib/
│   ├── stacks/
│   │   ├── network-stack.ts      # VPC, subnets, security groups
│   │   ├── database-stack.ts     # RDS, Redis, DynamoDB
│   │   ├── api-gateway-stack.ts  # REST + WebSocket API
│   │   ├── alb-stack.ts          # Application Load Balancer
│   │   ├── lambda-stack.ts       # Lambda functions (all services)
│   │   ├── jobs-stack.ts         # SQS + EventBridge
│   │   └── monitoring-stack.ts   # CloudWatch alarms
│   └── constructs/
│       ├── nodejs-lambda.ts      # Reusable Node.js Lambda
│       └── python-lambda.ts      # Reusable Python Lambda
├── config/
│   └── environments.ts           # Environment configs (dev/staging/prod)
├── cdk.json                      # CDK configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies
└── README.md                     # This file
```

## Environment Configuration

Three environments are supported:

### Development (dev)
- **Purpose**: Local testing and development
- **Cost**: ~$200/month
- **Features**:
  - Single NAT Gateway
  - Auto-pause RDS (10 min inactivity)
  - Small instance sizes
  - 7-day log retention

### Staging (staging)
- **Purpose**: Pre-production testing
- **Cost**: ~$400/month
- **Features**:
  - High availability (2 AZs)
  - No auto-pause RDS
  - Medium instance sizes
  - 30-day log retention

### Production (prod)
- **Purpose**: Live production environment
- **Cost**: ~$800-1,200/month
- **Features**:
  - High availability (3 AZs)
  - Multi-node Redis
  - Deletion protection
  - VPC Flow Logs
  - 90-day log retention
  - Reserved concurrency
  - Auto-scaling

## Installation

1. **Install dependencies:**
```bash
cd edulens-infrastructure
npm install
```

2. **Build TypeScript:**
```bash
npm run build
```

3. **Configure AWS credentials:**
```bash
aws configure
# OR set environment variables:
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

4. **Bootstrap CDK (first time only):**
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

## Deployment

### Deploy to Development

```bash
# Synthesize CloudFormation template
cdk synth --context stage=dev

# Deploy all stacks
cdk deploy --all --context stage=dev

# Deploy specific stack
cdk deploy EduLensNetworkStack-dev --context stage=dev
```

### Deploy to Staging

```bash
cdk deploy --all --context stage=staging
```

### Deploy to Production

```bash
# Review changes first
cdk diff --context stage=prod

# Deploy with approval prompts
cdk deploy --all --context stage=prod --require-approval broadening
```

## Stack Dependencies

Stacks must be deployed in order:

1. **NetworkStack** (no dependencies)
2. **DatabaseStack** (depends on Network)
3. **ApiGatewayStack** (no dependencies)
4. **AlbStack** (depends on Network)
5. **JobsStack** (no dependencies)
6. **LambdaStack** (depends on all above)
7. **MonitoringStack** (depends on Lambda)

CDK automatically handles the order when using `cdk deploy --all`.

## Useful Commands

```bash
# List all stacks
cdk list --context stage=dev

# View differences
cdk diff --context stage=dev

# Synthesize CloudFormation
cdk synth --context stage=dev

# Deploy all stacks
cdk deploy --all --context stage=dev

# Destroy all stacks
cdk destroy --all --context stage=dev

# Watch mode (auto-deploy on changes)
npm run watch

# Run TypeScript compiler
npm run build
```

## Outputs

After deployment, important values are exported as CloudFormation outputs:

```bash
# View stack outputs
aws cloudformation describe-stacks \
  --stack-name EduLensNetworkStack-dev \
  --query 'Stacks[0].Outputs'
```

**Key Outputs:**
- `RestApiUrl` - REST API endpoint
- `WebSocketApiUrl` - WebSocket API endpoint
- `AlbDnsName` - ALB DNS name (for SSE streaming)
- `AuroraClusterEndpoint` - Database endpoint
- `RedisEndpoint` - Redis endpoint
- `SummarizationQueueUrl` - SQS queue URL

## Configuration

### Modify Environment Settings

Edit `config/environments.ts` to change:

- VPC CIDR ranges
- Instance types
- Scaling limits
- Log retention periods
- Resource limits

### Enable AWS Bedrock

EduLens uses AWS Bedrock for Claude AI models instead of the Anthropic API directly:

```bash
# Enable model access via AWS Console
# 1. Go to https://console.aws.amazon.com/bedrock
# 2. Navigate to "Model access"
# 3. Enable:
#    - Anthropic Claude 3.5 Sonnet v2
#    - Anthropic Claude 3.5 Haiku v1
# 4. Wait 5-10 minutes for access to be granted
```

**Benefits:**
- IAM-based authentication (no API keys)
- Better AWS integration
- Same models and pricing
- Consolidated billing

See `../edulens-backend/BEDROCK-MIGRATION.md` for details.

## Cost Optimization

### Development
- Auto-pause RDS after 10 minutes
- Single NAT Gateway (~$32/month)
- Small instance sizes
- On-demand billing
- **Total: ~$150-200/month**

### Production
- Use Savings Plans for Lambda
- Reserved capacity for RDS
- Optimize Lambda memory (right-sizing)
- Use VPC endpoints (avoid NAT charges)
- Enable S3 Intelligent-Tiering for logs
- **Total: ~$800-1,200/month**

## Monitoring

### CloudWatch Dashboards

Automatically created dashboards:
- API Gateway metrics
- Lambda performance
- Database metrics
- Queue depths
- Error rates

### Alarms

Production alarms:
- High Lambda error rate (> 5%)
- High API Gateway 5xx errors
- DLQ has messages
- RDS high capacity
- Queue depth high (> 1000 messages)

### X-Ray Tracing

Enable X-Ray to trace requests across services:

```bash
# View service map
aws xray get-service-graph \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s)
```

## Security

### VPC Security

- Private subnets for Lambda and databases
- Isolated subnets for RDS (no internet)
- Security groups with least privilege
- NACLs for additional protection

### IAM Roles

Lambda functions have minimal permissions:
- Read database secrets
- Access specific DynamoDB tables
- Publish to specific SQS queues
- Write to CloudWatch Logs

### Encryption

- **RDS**: Encryption at rest (default)
- **SQS**: KMS encryption (production)
- **Secrets Manager**: AES-256 encryption
- **S3**: Default encryption

### Secrets Management

- Database credentials: AWS Secrets Manager
- API keys: AWS Secrets Manager
- Environment-specific secrets per stage

## Troubleshooting

### CDK Bootstrap Error

```
Error: This stack uses assets, so the toolkit stack must be deployed
```

**Solution:**
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### VPC Limit Error

```
Error: Cannot exceed 5 VPCs per region
```

**Solution:** Delete unused VPCs or request limit increase.

### Lambda Cold Starts

**Issue:** First request is slow after deployment.

**Solution:**
- Use provisioned concurrency (production)
- Enable Lambda SnapStart (Node.js only)
- Implement warming schedule

### RDS Connection Timeout

**Issue:** Lambda cannot connect to RDS.

**Solution:**
- Verify security group rules
- Check Lambda is in correct subnets
- Verify RDS is in isolated subnets
- Check NAT Gateway is working

## Maintenance

### Update Lambda Code

After updating service code:

```bash
# Rebuild Lambda packages
cd ../edulens-backend/services/test-engine
npm run build

# Redeploy Lambda stack
cd ../../../edulens-infrastructure
cdk deploy EduLensLambdaStack-dev --context stage=dev
```

### Database Migrations

```bash
# Run Prisma migrations
cd ../edulens-backend/packages/shared/database
npx prisma migrate deploy
```

### Rotate Secrets

```bash
# Rotate database password
aws secretsmanager rotate-secret \
  --secret-id edulens-db-credentials-prod \
  --rotation-lambda-arn arn:aws:lambda:...
```

## Cleanup

### Destroy Development Environment

```bash
# Destroy all stacks
cdk destroy --all --context stage=dev

# Manually delete:
# - S3 buckets
# - CloudWatch log groups (if not auto-deleted)
# - RDS snapshots (if retained)
```

**Warning:** Prod resources have deletion protection enabled!

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths:
      - 'edulens-infrastructure/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install CDK
        run: npm install -g aws-cdk

      - name: Install dependencies
        run: |
          cd edulens-infrastructure
          npm install

      - name: Deploy to staging
        run: |
          cd edulens-infrastructure
          cdk deploy --all --context stage=staging --require-approval never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Support

For issues or questions:
- **GitHub Issues**: https://github.com/yourusername/edulens/issues
- **Documentation**: https://docs.aws.amazon.com/cdk/
- **Email**: devops@edulens.com

## License

Copyright © 2026 EduLens. All rights reserved.
