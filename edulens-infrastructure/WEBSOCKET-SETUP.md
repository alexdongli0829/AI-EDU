# WebSocket Setup Guide

## What's the Issue?

During CDK deployment, I encountered a **cyclic dependency** when trying to connect WebSocket API routes to Lambda functions:

```
ApiGatewayStack creates WebSocket API
         ↓
LambdaStack needs API ID to add routes
         ↓
But routes need Lambda ARNs
         ↓
Creates circular dependency! ❌
```

**Solution**: WebSocket integrations are created **separately** after initial deployment.

## What's Deployed vs. What's Missing

### ✅ Already Deployed (via CDK)

- WebSocket API endpoint: `wss://xxxxx.execute-api.us-west-2.amazonaws.com/dev`
- Lambda functions:
  - `edulens-websocket-connect-dev`
  - `edulens-websocket-disconnect-dev`
  - `edulens-timer-sync-dev`
- DynamoDB connections table

### ❌ What's Missing

- **Routes**: `$connect` and `$disconnect` routes
- **Integrations**: Connection between API Gateway and Lambda functions
- **Permissions**: API Gateway permission to invoke Lambda

**Impact**: WebSocket connections won't work until you complete setup.

## Quick Setup (3 Options)

### Option 1: Automated Script (Easiest) ⭐

**Best for**: Quick setup, one command

```bash
cd /Volumes/workplace/AI-EDU/edulens-infrastructure

# Run the setup script
./scripts/connect-websocket.sh dev

# Test connection
npm install -g wscat
wscat -c wss://xxxxx.execute-api.us-west-2.amazonaws.com/dev
```

**What it does**:
- Gets API ID and Lambda ARNs automatically
- Creates integrations and routes
- Grants permissions
- Deploys the API

**Time**: ~1 minute

---

### Option 2: Manual AWS Console (Most Visual)

**Best for**: Understanding what's happening

1. Go to [API Gateway Console](https://console.aws.amazon.com/apigateway/)
2. Click on `edulens-ws-dev`
3. Click **Routes** → **Create**
4. Add `$connect` route → Attach Lambda integration → Select `edulens-websocket-connect-dev`
5. Add `$disconnect` route → Attach Lambda integration → Select `edulens-websocket-disconnect-dev`
6. Click **Deployments** → **Deploy API** → Stage: `dev`

**Full guide**: [docs/websocket-manual-setup.md](./docs/websocket-manual-setup.md)

**Time**: ~5 minutes

---

### Option 3: Separate CDK Stack (Best for Production)

**Best for**: Infrastructure as Code, reproducible deployments

**Step 1**: Edit `bin/app.ts` and uncomment this section at the end:

```typescript
// ============================================================
// WebSocket Integration Stack
// ============================================================

import { WebSocketIntegrationStack } from '../lib/stacks/websocket-integration-stack';

const websocketIntegrationStack = new WebSocketIntegrationStack(
  app,
  `EduLensWebSocketIntegrationStack-${config.stage}`,
  {
    env,
    config,
    description: `EduLens WebSocket Integrations (${config.stage})`,
    tags: config.tags,
  }
);

websocketIntegrationStack.addDependency(apiGatewayStack);
websocketIntegrationStack.addDependency(lambdaStack);
```

**Step 2**: Deploy the stack:

```bash
npx cdk deploy EduLensWebSocketIntegrationStack-dev --context stage=dev
```

**Full guide**: [docs/websocket-integration-deployment.md](./docs/websocket-integration-deployment.md)

**Time**: ~3 minutes

---

## Testing Your WebSocket

### Test Connection

```bash
# Install wscat
npm install -g wscat

# Get your WebSocket URL from CDK outputs
aws cloudformation describe-stacks \
  --stack-name EduLensApiGatewayStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketApiUrl`].OutputValue' \
  --output text

# Connect
wscat -c wss://xxxxx.execute-api.us-west-2.amazonaws.com/dev

# You should see: "Connected (press CTRL+C to quit)"
```

### View Logs

```bash
# Watch connection logs
aws logs tail /aws/lambda/edulens-websocket-connect-dev --follow

# In another terminal, connect
wscat -c wss://xxxxx.execute-api.us-west-2.amazonaws.com/dev
```

You should see log entries showing the connection!

### Check DynamoDB

```bash
# View active connections
aws dynamodb scan \
  --table-name edulens-websocket-connections-dev \
  --max-items 10
```

## Architecture After Setup

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ wss://
┌──────▼─────────────────┐
│  WebSocket API         │
│  (API Gateway)         │
├────────────────────────┤
│ $connect route         │──► websocket-connect Lambda
│                        │       ↓
│ $disconnect route      │──► websocket-disconnect Lambda
│                        │       ↓
└────────────────────────┘   DynamoDB (connections table)
```

## Why This Approach?

### The Problem with CDK

CDK cannot handle this dependency chain:
1. Lambda stack needs API Gateway resources (API ID)
2. API Gateway stack needs Lambda resources (function ARNs)
3. Result: **Circular dependency** 🔄

### Our Solution

Deploy in phases:
1. **Phase 1** (CDK): Deploy API Gateway + Lambda separately
2. **Phase 2** (Script/Manual/Separate Stack): Connect them together

This breaks the cycle! ✅

## FAQ

### Q: Do I have to do this for every deployment?

**A**: Only once per environment (dev, staging, prod). After setup, updates to Lambda functions don't break the routes.

### Q: What if I redeploy the API Gateway stack?

**A**: Routes may be deleted. Re-run the setup script or redeploy the integration stack.

### Q: Can I automate this in CI/CD?

**A**: Yes! Use **Option 1** (script) or **Option 3** (CDK stack) in your CI/CD pipeline:

```bash
# After main deployment
./deploy.sh dev deploy
./scripts/connect-websocket.sh dev
```

### Q: Will WebSocket work without this?

**A**: No. The WebSocket endpoint exists, but connections will fail with "Missing Authentication Token" or "Forbidden" errors.

### Q: What about the timer-sync function?

**A**: Timer-sync is triggered by EventBridge (not WebSocket), so it works immediately after deployment.

## Next Steps

1. ✅ Choose an option above and complete WebSocket setup
2. ✅ Test your WebSocket connection
3. ✅ Update frontend `.env` with WebSocket URL
4. ✅ Build and test your frontend application

## Need Help?

- **Manual setup**: See [docs/websocket-manual-setup.md](./docs/websocket-manual-setup.md)
- **CDK stack approach**: See [docs/websocket-integration-deployment.md](./docs/websocket-integration-deployment.md)
- **Troubleshooting**: Check CloudWatch Logs for Lambda functions
