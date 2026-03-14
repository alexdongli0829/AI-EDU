# WebSocket Manual Setup Guide

## Why Manual Setup is Needed

Due to CDK cyclic dependency limitations, WebSocket API routes need to be connected to Lambda functions after initial deployment.

## Steps to Connect WebSocket API

### 1. Get WebSocket API ID

From deployment outputs or:
```bash
aws apigatewayv2 get-apis --query "Items[?Name=='edulens-ws-dev'].ApiId" --output text
```

### 2. Get Lambda Function ARNs

```bash
# Connect function
aws lambda get-function --function-name edulens-websocket-connect-dev \
  --query 'Configuration.FunctionArn' --output text

# Disconnect function
aws lambda get-function --function-name edulens-websocket-disconnect-dev \
  --query 'Configuration.FunctionArn' --output text
```

### 3. Create Integrations via AWS Console

1. Go to [API Gateway Console](https://console.aws.amazon.com/apigateway/)
2. Click on your WebSocket API: `edulens-ws-dev`
3. Click **"Routes"** in the left menu

#### Create $connect Route:

4. Click **"Create"**
5. Route key: `$connect`
6. Click **"Create"**
7. Click on the `$connect` route
8. Click **"Attach integration"**
9. Integration type: **Lambda Function**
10. Lambda function: `edulens-websocket-connect-dev`
11. Click **"Create"**

#### Create $disconnect Route:

12. Repeat steps 4-11 but:
    - Route key: `$disconnect`
    - Lambda function: `edulens-websocket-disconnect-dev`

### 4. Grant API Gateway Permission to Invoke Lambda

```bash
# Get your account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)
API_ID="YOUR_WEBSOCKET_API_ID"  # From step 1

# Grant permission for $connect
aws lambda add-permission \
  --function-name edulens-websocket-connect-dev \
  --statement-id apigateway-websocket-connect \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*"

# Grant permission for $disconnect
aws lambda add-permission \
  --function-name edulens-websocket-disconnect-dev \
  --statement-id apigateway-websocket-disconnect \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*"
```

### 5. Deploy the WebSocket API

In the API Gateway Console:
1. Click **"Deployments"**
2. Click **"Deploy API"**
3. Stage: **dev**
4. Click **"Deploy"**

## Testing WebSocket Connection

```bash
# Install wscat if you don't have it
npm install -g wscat

# Get WebSocket URL from outputs
WS_URL="wss://xxxxx.execute-api.us-west-2.amazonaws.com/dev"

# Test connection
wscat -c $WS_URL

# You should see: Connected (press CTRL+C to quit)
```

## Verify Integration

Check CloudWatch Logs:
```bash
# Check connect function logs
aws logs tail /aws/lambda/edulens-websocket-connect-dev --follow

# In another terminal, connect with wscat
wscat -c $WS_URL
```

You should see log entries showing the connection.

## Troubleshooting

### Error: "Missing Authentication Token"
- Routes are not created or deployed
- Follow steps 3-5 again

### Error: "Internal Server Error"
- Check Lambda function logs:
  ```bash
  aws logs tail /aws/lambda/edulens-websocket-connect-dev --follow
  ```

### Connection Refused
- WebSocket API not deployed
- Deploy the API (step 5)

### Lambda Permission Denied
- Run the `aws lambda add-permission` commands (step 4)
