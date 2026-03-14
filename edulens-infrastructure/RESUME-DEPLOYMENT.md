# Resume Deployment Guide

## Current Status

### ✅ Successfully Deployed
1. **NetworkStack** - VPC, subnets, security groups
2. **DatabaseStack** - Aurora PostgreSQL 15.8, Redis, DynamoDB
3. **ApiGatewayStack** - REST API + WebSocket API
4. **AlbStack** - Application Load Balancer
5. **JobsStack** - SQS queues + EventBridge rules

### ❌ Failed / Not Deployed
6. **LambdaStack** - Failed deployment, needs cleanup and redeploy
7. **MonitoringStack** - Not yet deployed (depends on LambdaStack)

## Fixes Already Applied

All code fixes are saved to disk:

1. ✅ **Aurora PostgreSQL version** - Changed from 15.5 to 15.8
2. ✅ **Database secret access** - Changed from `connectionString` to `DB_SECRET_ARN`
3. ✅ **Lambda package size** - Excluded `venv/` directories and test files
4. ✅ **EventBridge rules** - Removed duplicate creation (will use script)
5. ✅ **ALB target groups** - Removed unsupported `deregistrationDelay`

## Resume Deployment Steps

### Step 1: Clean Up Failed Stack

```bash
cd /Volumes/workplace/AI-EDU/edulens-infrastructure

# Delete failed Lambda stack
aws cloudformation delete-stack --stack-name EduLensLambdaStack-dev

# Wait for deletion (2-3 minutes)
aws cloudformation wait stack-delete-complete --stack-name EduLensLambdaStack-dev

# Verify deletion
aws cloudformation describe-stacks --stack-name EduLensLambdaStack-dev
# Should get error: "Stack with id EduLensLambdaStack-dev does not exist"
```

### Step 2: Redeploy

```bash
# Deploy all remaining stacks
./deploy.sh dev deploy

# This will deploy:
# - LambdaStack (24 Lambda functions)
# - MonitoringStack (CloudWatch dashboards)
```

Expected time: 15-20 minutes

### Step 3: Post-Deployment Configuration

After successful deployment:

```bash
# 1. Connect WebSocket routes to Lambda functions
chmod +x scripts/connect-websocket.sh
./scripts/connect-websocket.sh dev

# 2. Connect EventBridge targets to Lambda functions
chmod +x scripts/connect-eventbridge.sh
./scripts/connect-eventbridge.sh dev
```

### Step 4: Verify Deployment

```bash
# List all deployed stacks
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `EduLens`)].StackName'

# Should see all 7 stacks:
# - EduLensNetworkStack-dev
# - EduLensDatabaseStack-dev
# - EduLensApiGatewayStack-dev
# - EduLensAlbStack-dev
# - EduLensJobsStack-dev
# - EduLensLambdaStack-dev
# - EduLensMonitoringStack-dev

# Get important outputs
aws cloudformation describe-stacks --stack-name EduLensApiGatewayStack-dev \
  --query 'Stacks[0].Outputs'
```

## Important Outputs to Save

After deployment completes, save these values:

```bash
# REST API URL
aws cloudformation describe-stacks --stack-name EduLensApiGatewayStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`RestApiUrl`].OutputValue' --output text

# WebSocket API URL
aws cloudformation describe-stacks --stack-name EduLensApiGatewayStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketApiUrl`].OutputValue' --output text

# Database endpoint
aws cloudformation describe-stacks --stack-name EduLensDatabaseStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`AuroraClusterEndpoint`].OutputValue' --output text

# CloudWatch Dashboard URL
aws cloudformation describe-stacks --stack-name EduLensMonitoringStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DashboardUrl`].OutputValue' --output text
```

## Known Issues & Solutions

### Issue: Lambda Stack Still Failing

**Check these:**

1. **Package size**: Ensure `venv/` is excluded
   ```bash
   ls -lah /Volumes/workplace/AI-EDU/edulens-backend/services/profile-engine/
   # Should NOT see venv/ being packaged
   ```

2. **Database secret**: Lambda uses `DB_SECRET_ARN`, not `DATABASE_URL`
   ```bash
   # Verify in code
   grep -r "DB_SECRET_ARN" lib/constructs/
   ```

3. **Stack not deleted**: Ensure old stack is fully deleted
   ```bash
   aws cloudformation describe-stacks --stack-name EduLensLambdaStack-dev
   # Should error if deleted
   ```

### Issue: WebSocket Not Working

Run the connection script:
```bash
./scripts/connect-websocket.sh dev
```

See: [WEBSOCKET-SETUP.md](./WEBSOCKET-SETUP.md)

### Issue: EventBridge Not Triggering

Run the connection script:
```bash
./scripts/connect-eventbridge.sh dev
```

## After Deployment

### 1. Update Frontend Configuration

Edit `edulens-frontend/.env.local`:
```bash
NEXT_PUBLIC_API_URL=https://xxxxx.execute-api.us-west-2.amazonaws.com/dev
NEXT_PUBLIC_WS_URL=wss://yyyyy.execute-api.us-west-2.amazonaws.com/dev
NEXT_PUBLIC_STREAMING_URL=http://edulens-alb-xxxxx.us-west-2.elb.amazonaws.com
```

### 2. Update Backend Code

Lambda functions now receive `DB_SECRET_ARN` instead of `DATABASE_URL`.

See: [docs/DATABASE-CONNECTION.md](./docs/DATABASE-CONNECTION.md)

### 3. Test API Endpoints

```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks --stack-name EduLensApiGatewayStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`RestApiUrl`].OutputValue' --output text)

# Test endpoint (adjust as needed)
curl $API_URL/health || echo "Health endpoint not implemented yet"
```

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Quick deployment guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment docs
- **[WEBSOCKET-SETUP.md](./WEBSOCKET-SETUP.md)** - WebSocket integration
- **[DATABASE-CONNECTION.md](./docs/DATABASE-CONNECTION.md)** - Database connection guide
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture
- **[FIX-DEPLOYMENT-ERRORS.md](./FIX-DEPLOYMENT-ERRORS.md)** - Error troubleshooting

## Estimated Time

- Stack cleanup: 2-3 minutes
- Deployment: 15-20 minutes
- Post-deployment scripts: 2-3 minutes
- **Total**: ~20-25 minutes

## Cost

While stacks are deployed (dev environment):
- **Hourly**: ~$0.05/hour (mostly Aurora + NAT Gateway)
- **Daily**: ~$2.50/day
- **Monthly**: ~$75/month (with Aurora auto-pause)

## Next Steps After Successful Deployment

1. ✅ Configure AWS Bedrock model access
2. ✅ Initialize database schema
3. ✅ Update backend Lambda code to use `DB_SECRET_ARN`
4. ✅ Update frontend environment variables
5. ✅ Test all API endpoints
6. ✅ Deploy frontend application

---

**Questions?** Check the documentation files or review Claude Code conversation history.
