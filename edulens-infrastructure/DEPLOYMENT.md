# EduLens Infrastructure Deployment Guide

## Prerequisites

### 1. AWS Account Setup

You need:
- An AWS account
- AWS CLI configured with credentials
- Appropriate IAM permissions for CDK deployments

### 2. Configure AWS Credentials

**Option A: Using AWS CLI**
```bash
aws configure
```

Enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `us-west-2`)
- Default output format (e.g., `json`)

**Option B: Using Environment Variables**
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-west-2
```

**Option C: Using AWS SSO**
```bash
aws sso login --profile your-profile
export AWS_PROFILE=your-profile
```

### 3. Update Account Configuration

Edit `config/environments.ts` and replace the placeholder account ID with your actual AWS account ID:

```typescript
export const devConfig: EnvironmentConfig = {
  account: process.env.CDK_DEFAULT_ACCOUNT || 'YOUR_ACTUAL_ACCOUNT_ID',
  region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  stage: 'dev',
  // ...
};
```

To get your account ID:
```bash
aws sts get-caller-identity --query Account --output text
```

## Deployment Steps

### Step 1: Bootstrap CDK (First Time Only)

CDK needs to bootstrap your AWS account/region to create resources it needs:

```bash
cd /Volumes/workplace/AI-EDU/edulens-infrastructure

# Bootstrap the account
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-west-2 --context stage=dev
```

This creates:
- An S3 bucket for CDK assets
- IAM roles for deployments
- CloudFormation stack: `CDKToolkit`

### Step 2: Review What Will Be Deployed

```bash
# List all stacks
npx cdk list --context stage=dev

# View changes (diff)
npx cdk diff --context stage=dev

# Synthesize CloudFormation templates
npx cdk synth --context stage=dev
```

### Step 3: Deploy All Stacks

**Option A: Deploy All Stacks at Once**
```bash
npx cdk deploy --all --context stage=dev --require-approval never
```

**Option B: Deploy Stacks One by One (Recommended for First Deployment)**
```bash
# Deploy in order (though CDK handles dependencies automatically)
npx cdk deploy EduLensNetworkStack-dev --context stage=dev
npx cdk deploy EduLensDatabaseStack-dev --context stage=dev
npx cdk deploy EduLensApiGatewayStack-dev --context stage=dev
npx cdk deploy EduLensAlbStack-dev --context stage=dev
npx cdk deploy EduLensJobsStack-dev --context stage=dev
npx cdk deploy EduLensLambdaStack-dev --context stage=dev
npx cdk deploy EduLensMonitoringStack-dev --context stage=dev
```

**Option C: Deploy with Approval Prompts**
```bash
# CDK will ask for confirmation before creating/updating resources
npx cdk deploy --all --context stage=dev
```

### Step 4: Note Important Outputs

After deployment, CDK will output important values:

```
Outputs:
EduLensApiGatewayStack-dev.RestApiUrl = https://xxxxx.execute-api.us-west-2.amazonaws.com/dev/
EduLensApiGatewayStack-dev.WebSocketApiUrl = wss://yyyyy.execute-api.us-west-2.amazonaws.com/dev
EduLensDatabaseStack-dev.AuroraClusterEndpoint = xxxxx.cluster-xxxxx.us-west-2.rds.amazonaws.com
EduLensMonitoringStack-dev.DashboardUrl = https://console.aws.amazon.com/cloudwatch/...
```

**Save these values** - you'll need them for:
- Frontend configuration
- Backend environment variables
- Monitoring and debugging

## Post-Deployment Configuration

### 0. Setup WebSocket Connections (Important!)

**⚠️ WebSocket routes need manual setup after first deployment due to cyclic dependency limitations.**

Choose one method (easiest first):

**Option 1 - Automated Script (Recommended):**
```bash
./scripts/connect-websocket.sh dev
```

**Option 2 - AWS Console:** Follow [docs/websocket-manual-setup.md](./docs/websocket-manual-setup.md)

**Option 3 - CDK Stack:** Follow [docs/websocket-integration-deployment.md](./docs/websocket-integration-deployment.md)

**See [WEBSOCKET-SETUP.md](./WEBSOCKET-SETUP.md) for complete details.**

### 1. Update Environment Variables

The Lambda functions need these environment variables (already configured in CDK):
- `DATABASE_URL` - Automatically set from Secrets Manager
- `REDIS_URL` - Automatically set from Redis endpoint
- `AI_PROVIDER=bedrock` - Already configured
- `STAGE=dev` - Already configured

### 2. Configure AWS Bedrock Access

Ensure your AWS account has access to Claude models in Bedrock:

```bash
# Check available models
aws bedrock list-foundation-models --region us-west-2 \
  --query 'modelSummaries[?contains(modelId, `anthropic.claude`)].{ModelId:modelId,Name:modelName}'
```

If you don't have access, request it in the AWS Console:
1. Go to AWS Bedrock console
2. Navigate to "Model access"
3. Request access to:
   - `anthropic.claude-3-5-sonnet-20241022-v2:0`
   - `anthropic.claude-3-5-haiku-20241022-v1:0`

### 3. Get Database Credentials

The Aurora database password is stored in AWS Secrets Manager:

```bash
# Get the secret ARN from outputs
aws secretsmanager get-secret-value \
  --secret-id edulens-aurora-credentials-dev \
  --query SecretString --output text | jq .
```

### 4. Initialize Database Schema

You'll need to:
1. Connect to Aurora via VPC (use bastion host or AWS Systems Manager)
2. Run your database migration scripts
3. Seed initial data (question banks, etc.)

```bash
# Example: Connect via AWS Systems Manager Session Manager
# (Requires a bastion host in the VPC)
```

### 5. Test API Endpoints

```bash
# Get the API URL from outputs
API_URL="https://xxxxx.execute-api.us-west-2.amazonaws.com/dev"

# Test health check (if you have one)
curl $API_URL/health

# Test with authentication
curl -X POST $API_URL/tests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"Sample Test","questions":[]}'
```

### 6. Configure Frontend

Update your frontend `.env` file:

```bash
# edulens-frontend/.env.local
NEXT_PUBLIC_API_URL=https://xxxxx.execute-api.us-west-2.amazonaws.com/dev
NEXT_PUBLIC_WS_URL=wss://yyyyy.execute-api.us-west-2.amazonaws.com/dev
NEXT_PUBLIC_STREAMING_URL=http://edulens-alb-xxxxx.us-west-2.elb.amazonaws.com
```

## Deployment to Other Environments

### Staging
```bash
# Update config in config/environments.ts with staging account
npx cdk deploy --all --context stage=staging
```

### Production
```bash
# Update config in config/environments.ts with prod account
npx cdk deploy --all --context stage=prod
```

## Monitoring Deployment

### View CloudFormation Stacks
```bash
# List all stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Describe specific stack
aws cloudformation describe-stacks --stack-name EduLensLambdaStack-dev
```

### View Logs During Deployment
```bash
# In another terminal, watch CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name EduLensLambdaStack-dev \
  --max-items 10
```

## Troubleshooting

### Issue: "Cannot assume role"
```
Solution: Ensure CDK bootstrap was run successfully
npx cdk bootstrap --context stage=dev
```

### Issue: "Insufficient permissions"
```
Solution: Your IAM user/role needs these permissions:
- CloudFormation: Full access
- IAM: Create/manage roles
- EC2: VPC, Security Groups
- RDS: Create clusters
- Lambda: Create functions
- API Gateway: Create APIs
- S3: Create buckets (for CDK assets)
```

### Issue: Database credentials not found
```
Solution: Check Secrets Manager
aws secretsmanager list-secrets --filters Key=name,Values=edulens
```

### Issue: Lambda deployment package too large
```
Solution: Ensure node_modules are not included
- Add .dockerignore to backend services
- Use Lambda layers for large dependencies
```

## Updating the Infrastructure

After making changes to CDK code:

```bash
# See what will change
npx cdk diff --context stage=dev

# Deploy the changes
npx cdk deploy --all --context stage=dev
```

## Destroying Resources

**⚠️ WARNING: This will delete all resources and data!**

```bash
# Destroy all stacks
npx cdk destroy --all --context stage=dev

# Or destroy specific stacks
npx cdk destroy EduLensMonitoringStack-dev --context stage=dev
```

## Cost Optimization for Dev

To minimize costs in dev environment:

1. **Stop Aurora when not in use:**
   - Auto-pause is enabled (10 minutes)
   - Manually stop in console

2. **Delete unused resources:**
   ```bash
   npx cdk destroy EduLensMonitoringStack-dev --context stage=dev
   ```

3. **Use smaller instance types:**
   - Already configured in `config/environments.ts`

4. **Monitor costs:**
   ```bash
   aws ce get-cost-and-usage \
     --time-period Start=2024-03-01,End=2024-03-14 \
     --granularity MONTHLY \
     --metrics BlendedCost \
     --group-by Type=TAG,Key=Project
   ```

## Next Steps After Deployment

1. ✅ Configure Cognito (if using) for authentication
2. ✅ Set up CI/CD pipeline
3. ✅ Configure custom domain names
4. ✅ Set up CloudWatch alarms and SNS notifications
5. ✅ Configure WAF for API Gateway (production)
6. ✅ Set up database backups and point-in-time recovery
7. ✅ Configure VPC Flow Logs for network monitoring
8. ✅ Deploy WebSocket integrations (currently commented out)

## Support

For issues or questions:
- Check AWS CloudWatch Logs
- Review CloudFormation events
- Check IAM permissions
- Verify AWS Bedrock model access
