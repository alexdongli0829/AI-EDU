# WebSocket Integration Deployment (Option 2 - CDK Stack)

## Overview

This guide shows how to deploy WebSocket integrations using a separate CDK stack after the main infrastructure is deployed.

## Why a Separate Stack?

During initial deployment, connecting WebSocket API routes to Lambda functions creates a **cyclic dependency**:
- API Gateway stack needs to know about Lambda functions
- Lambda stack needs to know about API Gateway
- Result: Circular reference that CloudFormation can't resolve

The solution: Deploy WebSocket routes in a **separate stack** after both API Gateway and Lambda stacks exist.

## Prerequisites

Main infrastructure must be deployed:
```bash
./deploy.sh dev deploy
```

## Deploy WebSocket Integration Stack

### Step 1: Add Stack to CDK App

Edit `bin/app.ts` and add after the Monitoring stack:

```typescript
// ============================================================
// WebSocket Integration Stack (Deploy separately to avoid cycles)
// ============================================================

// Uncomment to deploy WebSocket integrations
/*
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
*/
```

### Step 2: Uncomment and Deploy

```bash
# 1. Uncomment the WebSocket integration stack code in bin/app.ts

# 2. Deploy just the WebSocket integration stack
npx cdk deploy EduLensWebSocketIntegrationStack-dev --context stage=dev
```

### Step 3: Verify Deployment

```bash
# Get WebSocket URL from outputs
aws cloudformation describe-stacks \
  --stack-name EduLensWebSocketIntegrationStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketUrl`].OutputValue' \
  --output text

# Test WebSocket connection
npm install -g wscat
wscat -c wss://xxxxx.execute-api.us-west-2.amazonaws.com/dev

# You should see: Connected (press CTRL+C to quit)
```

## What Gets Created

The WebSocket integration stack creates:

1. **$connect Route**
   - Connects to `edulens-websocket-connect-dev` Lambda
   - Handles new WebSocket connections

2. **$disconnect Route**
   - Connects to `edulens-websocket-disconnect-dev` Lambda
   - Handles WebSocket disconnections

3. **Lambda Permissions**
   - Allows API Gateway to invoke WebSocket Lambda functions

## Architecture After Integration

```
Client
  ↓
WebSocket API (API Gateway)
  ├─ $connect route → websocket-connect Lambda
  └─ $disconnect route → websocket-disconnect Lambda
       ↓
  DynamoDB (connections table)
```

## Troubleshooting

### Error: "Cannot import value from stack"

**Problem**: Main stacks need to export values for integration stack to import.

**Solution**: Ensure API Gateway stack exports are correct (already fixed in code).

### Error: "Resource not found"

**Problem**: Lambda function names don't match.

**Solution**: Check function names:
```bash
aws lambda list-functions --query 'Functions[?contains(FunctionName, `websocket`)].FunctionName'
```

### Error: "Integration already exists"

**Problem**: Routes were created manually before.

**Solution**: Delete existing routes:
```bash
API_ID=$(aws cloudformation describe-stacks \
  --stack-name EduLensApiGatewayStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketApiId`].OutputValue' \
  --output text)

# List routes
aws apigatewayv2 get-routes --api-id $API_ID

# Delete routes if needed
aws apigatewayv2 delete-route --api-id $API_ID --route-id ROUTE_ID
```

## Testing WebSocket Functionality

### Test Connection

```bash
# Install wscat
npm install -g wscat

# Connect
wscat -c wss://xxxxx.execute-api.us-west-2.amazonaws.com/dev
```

### Check Logs

```bash
# Connect function logs
aws logs tail /aws/lambda/edulens-websocket-connect-dev --follow

# Disconnect function logs
aws logs tail /aws/lambda/edulens-websocket-disconnect-dev --follow
```

### Check DynamoDB Connections

```bash
# Scan connections table
aws dynamodb scan \
  --table-name edulens-websocket-connections-dev \
  --max-items 10
```

## Cleanup

To remove WebSocket integrations:

```bash
npx cdk destroy EduLensWebSocketIntegrationStack-dev --context stage=dev
```

This removes routes but keeps Lambda functions and WebSocket API (they're in other stacks).

## Alternative: One-Command Deployment (Future)

After the first deployment, you can deploy everything including WebSocket:

```bash
# Edit bin/app.ts and uncomment WebSocket integration stack
# Then deploy all stacks
npx cdk deploy --all --context stage=dev
```

The integration stack will only be created after main stacks exist, avoiding the cyclic dependency.
