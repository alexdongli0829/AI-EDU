# EduLens Infrastructure Deployment Guide

Complete step-by-step guide for deploying the EduLens infrastructure to AWS.

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **AWS Account** with administrative access
- [ ] **AWS CLI** installed and configured (`aws --version`)
- [ ] **Node.js 20.x** or later (`node --version`)
- [ ] **AWS CDK 2.133.0** or later (`npm install -g aws-cdk`)
- [ ] **AWS Bedrock** access enabled in your region (Claude models)
- [ ] **PostgreSQL client** (optional, for database verification)

## Step 1: Prepare Backend Services

Before deploying infrastructure, build all backend services:

```bash
cd ../edulens-backend

# Install dependencies
npm install

# Build all services
npm run build

# Run tests to verify everything works
npm test
```

**Expected output:** All services should build successfully with no errors.

## Step 2: AWS Configuration

### 2.1 Configure AWS Credentials

```bash
aws configure
```

Enter your:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `us-east-1`)
- Default output format: `json`

### 2.2 Verify AWS Access

```bash
# Get your AWS account ID
aws sts get-caller-identity

# Should return:
# {
#   "UserId": "...",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/..."
# }
```

**Important:** Copy your **Account ID** - you'll need it in the next step.

### 2.3 Update Environment Configuration

Edit `config/environments.ts` and update the account IDs:

```typescript
export const devConfig: EnvironmentConfig = {
  // ...
  account: '123456789012', // Replace with YOUR account ID
  region: 'us-east-1',     // Your preferred region
  // ...
};
```

Do the same for `stagingConfig` and `prodConfig`.

## Step 3: CDK Bootstrap

Bootstrap CDK in your AWS account (one-time operation):

```bash
cd edulens-infrastructure

# Install CDK dependencies
npm install

# Bootstrap CDK (replace with your account ID and region)
cdk bootstrap aws://123456789012/us-east-1
```

**Expected output:**
```
 ✅  Environment aws://123456789012/us-east-1 bootstrapped.
```

## Step 4: Enable AWS Bedrock Models

EduLens uses AWS Bedrock to access Claude models instead of the Anthropic API directly. This provides better AWS integration and uses IAM roles for authentication.

### 4.1 Enable Bedrock Model Access

```bash
# Check if Bedrock is available in your region
aws bedrock list-foundation-models --region us-east-1

# Enable model access through the AWS Console:
# 1. Go to https://console.aws.amazon.com/bedrock
# 2. Navigate to "Model access" in the left sidebar
# 3. Click "Manage model access"
# 4. Enable the following models:
#    - Anthropic Claude 3.5 Sonnet v2
#    - Anthropic Claude 3.5 Haiku v1
# 5. Click "Save changes"
```

**Required Models:**
- `anthropic.claude-3-5-sonnet-20241022-v2:0` - For interactive chat (parent/student)
- `anthropic.claude-3-5-haiku-20241022-v1:0` - For background summarization

**Important:** Model access can take 5-10 minutes to activate. Wait for the status to show "Access granted" before deploying.

### 4.2 Verify Model Access

```bash
# Test if you can access Claude models
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query 'modelSummaries[?starts_with(modelId, `anthropic.claude-3-5`)].{ModelId:modelId,Status:modelLifecycle.status}' \
  --output table

# Expected output should show both models as ACTIVE
```

### 4.3 Regional Availability

AWS Bedrock with Claude models is available in these regions:
- `us-east-1` (N. Virginia) ✅ Recommended
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `ap-southeast-1` (Singapore)
- `ap-northeast-1` (Tokyo)

**Note:** If Bedrock is not available in your region, choose one of the supported regions above and update your `config/environments.ts` file.

## Step 5: Build CDK Application

```bash
cd edulens-infrastructure

# Install dependencies (if not already done)
npm install

# Build TypeScript
npm run build
```

**Expected output:** No errors, TypeScript compiles successfully.

## Step 6: Preview Changes

Before deploying, preview what will be created:

```bash
# Synthesize CloudFormation templates
cdk synth --context stage=dev

# List all stacks
cdk list --context stage=dev

# Expected output:
# EduLensNetworkStack-dev
# EduLensDatabaseStack-dev
# EduLensApiGatewayStack-dev
# EduLensAlbStack-dev
# EduLensJobsStack-dev
# EduLensLambdaStack-dev
# EduLensMonitoringStack-dev

# View differences (first deployment will show all resources as new)
cdk diff --context stage=dev
```

## Step 7: Deploy Infrastructure

### 7.1 Development Environment

Deploy all stacks (recommended for first deployment):

```bash
cdk deploy --all --context stage=dev
```

**This will:**
1. Create VPC with subnets, NAT Gateway, security groups (~5 min)
2. Create RDS Aurora cluster, Redis, DynamoDB (~10 min)
3. Create API Gateway REST + WebSocket APIs (~2 min)
4. Create Application Load Balancer (~3 min)
5. Create SQS queues and EventBridge rules (~1 min)
6. Deploy 24 Lambda functions (~5 min)
7. Create CloudWatch dashboards and alarms (~1 min)

**Total time:** ~25-30 minutes

You'll be prompted to approve security-sensitive changes. Review and type `y` to proceed.

### 7.2 Monitor Deployment

In another terminal, watch CloudFormation events:

```bash
# Watch Network stack
aws cloudformation describe-stack-events \
  --stack-name EduLensNetworkStack-dev \
  --max-items 10 \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId]' \
  --output table

# Or use AWS Console
# https://console.aws.amazon.com/cloudformation
```

## Step 8: Verify Deployment

### 8.1 Get Stack Outputs

```bash
# Network outputs
aws cloudformation describe-stacks \
  --stack-name EduLensNetworkStack-dev \
  --query 'Stacks[0].Outputs' \
  --output table

# API Gateway outputs
aws cloudformation describe-stacks \
  --stack-name EduLensApiGatewayStack-dev \
  --query 'Stacks[0].Outputs' \
  --output table

# Database outputs
aws cloudformation describe-stacks \
  --stack-name EduLensDatabaseStack-dev \
  --query 'Stacks[0].Outputs' \
  --output table
```

### 8.2 Test API Gateway

```bash
# Get REST API URL from outputs
REST_API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com/dev"

# Test health endpoint (you'll need to create this)
curl "${REST_API_URL}/health"
```

### 8.3 Check Lambda Functions

```bash
# List Lambda functions
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `edulens`)].FunctionName' \
  --output table

# Invoke a test function
aws lambda invoke \
  --function-name edulens-get-test-dev \
  --payload '{"pathParameters":{"testId":"test123"}}' \
  response.json

cat response.json
```

### 8.4 Verify Database

```bash
# Get database endpoint
DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name EduLensDatabaseStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`AuroraClusterEndpoint`].OutputValue' \
  --output text)

echo "Database endpoint: ${DB_ENDPOINT}"

# Get database password from secrets manager
aws secretsmanager get-secret-value \
  --secret-id edulens-db-credentials-dev \
  --query 'SecretString' \
  --output text | jq -r '.password'
```

Connect with psql:
```bash
psql -h ${DB_ENDPOINT} -U edulens_admin -d edulens
```

### 8.5 Check CloudWatch Dashboard

```bash
# Get dashboard URL
aws cloudformation describe-stacks \
  --stack-name EduLensMonitoringStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DashboardUrl`].OutputValue' \
  --output text
```

Open the URL in your browser to view metrics.

## Step 9: Run Database Migrations

After infrastructure is deployed, run Prisma migrations:

```bash
cd ../edulens-backend/packages/shared/database

# Generate Prisma client
npx prisma generate

# Run migrations
DATABASE_URL="postgresql://edulens_admin:PASSWORD@${DB_ENDPOINT}:5432/edulens" \
npx prisma migrate deploy
```

## Step 10: Smoke Tests

### 10.1 Create a Test

```bash
REST_API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com/dev"

curl -X POST "${REST_API_URL}/tests" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sample Math Test",
    "description": "Basic arithmetic test",
    "timeLimit": 3600,
    "questionIds": []
  }'
```

### 10.2 Test WebSocket Connection

```bash
# Get WebSocket URL
WS_API_URL=$(aws cloudformation describe-stacks \
  --stack-name EduLensApiGatewayStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketApiUrl`].OutputValue' \
  --output text)

# Use wscat to test
npm install -g wscat
wscat -c "${WS_API_URL}?studentId=student123&sessionId=session123"
```

### 10.3 Test SSE Streaming

```bash
# Get ALB DNS name
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name EduLensAlbStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`AlbDnsName`].OutputValue' \
  --output text)

# Test SSE endpoint (after creating a chat session)
curl -N "http://${ALB_DNS}/student-chat/session123/send" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, can you help me with math?"}'
```

## Troubleshooting

### Issue: CDK Bootstrap Failed

**Error:** `This stack uses assets, so the toolkit stack must be deployed`

**Solution:**
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION --force
```

### Issue: Deployment Timeout

**Error:** `Stack creation timed out`

**Solution:** RDS Aurora can take 10-15 minutes to create. Be patient or check:
```bash
aws cloudformation describe-stack-events \
  --stack-name EduLensDatabaseStack-dev \
  --max-items 5
```

### Issue: Lambda Function Errors

**Error:** Lambda shows errors in CloudWatch

**Solution:**
1. Check Lambda logs:
```bash
aws logs tail /aws/lambda/edulens-create-test-dev --follow
```

2. Verify code is built:
```bash
cd ../edulens-backend/services/test-engine
npm run build
```

3. Redeploy Lambda stack:
```bash
cd ../../edulens-infrastructure
cdk deploy EduLensLambdaStack-dev --context stage=dev
```

### Issue: VPC Limit Exceeded

**Error:** `Cannot exceed 5 VPCs per region`

**Solution:** Delete unused VPCs or deploy to a different region:
```bash
# List VPCs
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,Tags[?Key==`Name`].Value|[0]]' --output table

# Delete unused VPC (careful!)
aws ec2 delete-vpc --vpc-id vpc-xxxxx
```

### Issue: Bedrock Model Access Denied

**Error:** `AccessDeniedException: Could not access model`

**Solution:**
1. Enable model access in Bedrock console (see Step 4.1)
2. Wait 5-10 minutes for access to be granted
3. Verify with `aws bedrock list-foundation-models`

### Issue: Bedrock Not Available in Region

**Error:** `Bedrock is not available in region xyz`

**Solution:**
1. Choose a supported region (us-east-1, us-west-2, eu-west-1)
2. Update `config/environments.ts` with the new region
3. Redeploy infrastructure

## Cost Monitoring

Monitor your AWS costs:

```bash
# Get current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --group-by Type=TAG,Key=Stage
```

**Expected development costs:** ~$150-200/month

## Cleanup (Development Only!)

To destroy all resources:

```bash
# WARNING: This will delete EVERYTHING
cdk destroy --all --context stage=dev

# Confirm each stack deletion by typing the stack name

# Manually delete:
# - S3 buckets (CDK asset bucket)
# - CloudWatch log groups (if retention is not set)
# - RDS snapshots (if you want to keep them)
```

## Next Steps

1. **CI/CD Pipeline** - Set up GitHub Actions for automated deployments
2. **Custom Domain** - Add Route53 and ACM certificate for production
3. **Monitoring** - Set up SNS topics for CloudWatch alarms
4. **Backup Strategy** - Configure automated RDS backups
5. **Load Testing** - Run performance tests with realistic load

## Support

- **AWS CDK Documentation**: https://docs.aws.amazon.com/cdk/
- **Troubleshooting Guide**: See `README.md` section on Troubleshooting
- **GitHub Issues**: https://github.com/yourusername/edulens/issues

---

**Congratulations!** 🎉 Your EduLens infrastructure is now deployed and ready for testing.
