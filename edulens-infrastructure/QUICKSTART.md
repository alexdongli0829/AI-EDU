# Quick Start Guide

## 5-Minute Deployment

### 1. Configure AWS Credentials

```bash
# Option 1: AWS CLI
aws configure

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-west-2
```

### 2. Update Account ID

Get your AWS account ID:
```bash
aws sts get-caller-identity --query Account --output text
```

Edit `config/environments.ts` line 43:
```typescript
account: process.env.CDK_DEFAULT_ACCOUNT || 'YOUR_ACCOUNT_ID',
```

### 3. Deploy Everything

```bash
cd /Volumes/workplace/AI-EDU/edulens-infrastructure

# Using the deploy script (recommended)
./deploy.sh dev deploy

# Or manually
npx cdk bootstrap --context stage=dev  # First time only
npx cdk deploy --all --context stage=dev --require-approval never
```

### 4. Setup WebSocket (1 Command)

WebSocket routes need to be connected after deployment:

```bash
./scripts/connect-websocket.sh dev
```

**Why?** CDK cyclic dependency limitation. See [WEBSOCKET-SETUP.md](./WEBSOCKET-SETUP.md)

### 5. Save Outputs

After deployment, save these URLs:
- **REST API URL**: `https://xxxxx.execute-api.us-west-2.amazonaws.com/dev/`
- **WebSocket URL**: `wss://yyyyy.execute-api.us-west-2.amazonaws.com/dev`
- **Database Endpoint**: `xxxxx.cluster-xxxxx.us-west-2.rds.amazonaws.com`

### 6. Configure Bedrock Access

Request access to Claude models:
1. Go to [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Click "Model access"
3. Request access to:
   - `anthropic.claude-3-5-sonnet-20241022-v2:0`
   - `anthropic.claude-3-5-haiku-20241022-v1:0`

### 7. Update Frontend Config

Edit `edulens-frontend/.env.local`:
```bash
NEXT_PUBLIC_API_URL=https://xxxxx.execute-api.us-west-2.amazonaws.com/dev
NEXT_PUBLIC_WS_URL=wss://yyyyy.execute-api.us-west-2.amazonaws.com/dev
```

## Common Commands

```bash
# Check what will change before deploying
./deploy.sh dev diff

# List all stacks
./deploy.sh dev list

# Deploy to staging
./deploy.sh staging deploy

# Destroy dev environment
./deploy.sh dev destroy

# View CloudFormation templates
./deploy.sh dev synth
```

## Troubleshooting

### Can't assume role
```bash
npx cdk bootstrap --context stage=dev
```

### Database connection error
```bash
# Get database password
aws secretsmanager get-secret-value \
  --secret-id edulens-aurora-credentials-dev \
  --query SecretString --output text | jq .
```

### Lambda deployment failed
Check CloudWatch Logs:
```bash
aws logs tail /aws/lambda/edulens-create-test-dev --follow
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
           ┌───────────┴──────────┐
           │                      │
    ┌──────▼──────┐      ┌───────▼────────┐
    │ API Gateway │      │  ALB (Streaming)│
    │  (REST/WS)  │      │                 │
    └──────┬──────┘      └───────┬────────┘
           │                      │
           └───────────┬──────────┘
                       │
              ┌────────▼─────────┐
              │  Lambda Functions │
              │  (24 functions)   │
              └────────┬──────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
  ┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐
  │  Aurora   │  │  Redis  │  │ EventBridge │
  │ PostgreSQL│  │  Cache  │  │   + SQS     │
  └───────────┘  └─────────┘  └─────────────┘
```

## Stack Dependencies

```
NetworkStack (VPC, Subnets, Security Groups)
    ↓
DatabaseStack (Aurora, Redis, DynamoDB)
    ↓
ApiGatewayStack (REST API, WebSocket)
AlbStack (Load Balancer for SSE)
JobsStack (SQS, EventBridge)
    ↓
LambdaStack (24 Lambda Functions)
    ↓
MonitoringStack (CloudWatch Dashboards & Alarms)
```

## Cost Estimate (Dev Environment)

- **VPC**: Free (1 NAT Gateway: ~$32/month)
- **Aurora Serverless**: ~$0.12/hour when active (auto-pause after 10 min)
- **Redis**: cache.t4g.micro ~$12/month
- **Lambda**: Free tier covers most dev usage
- **API Gateway**: $3.50 per million requests
- **DynamoDB**: Free tier (25GB, 200M requests)
- **CloudWatch**: ~$5/month for logs

**Estimated Monthly Cost (Dev)**: $50-100/month (with auto-pause)

## Production Considerations

Before deploying to production:

1. ✅ Configure custom domain with Route53/CloudFront
2. ✅ Enable WAF on API Gateway
3. ✅ Set up automated backups
4. ✅ Configure CloudWatch alarms with SNS
5. ✅ Enable VPC Flow Logs
6. ✅ Review IAM permissions (principle of least privilege)
7. ✅ Enable encryption at rest for all data stores
8. ✅ Set up CI/CD pipeline
9. ✅ Configure SSL/TLS certificates
10. ✅ Enable X-Ray tracing

See `DEPLOYMENT.md` for complete details.
