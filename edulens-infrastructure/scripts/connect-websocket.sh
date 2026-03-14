#!/bin/bash

# WebSocket Integration Setup Script
# Connects WebSocket API routes to Lambda functions after deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

STAGE=${1:-dev}

echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}WebSocket Integration Setup${NC}"
echo -e "${GREEN}===============================================${NC}"
echo ""
echo -e "Stage: ${YELLOW}$STAGE${NC}"
echo ""

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured!${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-west-2")

echo -e "${GREEN}Account:${NC} $ACCOUNT_ID"
echo -e "${GREEN}Region:${NC} $REGION"
echo ""

# ============================================================
# Get WebSocket API ID
# ============================================================

echo -e "${YELLOW}1. Getting WebSocket API ID...${NC}"
API_ID=$(aws cloudformation describe-stacks \
  --stack-name EduLensApiGatewayStack-$STAGE \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketApiId`].OutputValue' \
  --output text 2>/dev/null)

if [ -z "$API_ID" ]; then
    echo -e "${RED}Error: Could not find WebSocket API${NC}"
    echo "Make sure EduLensApiGatewayStack-$STAGE is deployed"
    exit 1
fi

echo -e "   API ID: ${GREEN}$API_ID${NC}"

# ============================================================
# Get Lambda Function ARNs
# ============================================================

echo -e "${YELLOW}2. Getting Lambda function ARNs...${NC}"

CONNECT_ARN=$(aws lambda get-function \
  --function-name edulens-websocket-connect-$STAGE \
  --query 'Configuration.FunctionArn' \
  --output text 2>/dev/null)

DISCONNECT_ARN=$(aws lambda get-function \
  --function-name edulens-websocket-disconnect-$STAGE \
  --query 'Configuration.FunctionArn' \
  --output text 2>/dev/null)

if [ -z "$CONNECT_ARN" ] || [ -z "$DISCONNECT_ARN" ]; then
    echo -e "${RED}Error: Could not find WebSocket Lambda functions${NC}"
    echo "Make sure EduLensLambdaStack-$STAGE is deployed"
    exit 1
fi

echo -e "   Connect function: ${GREEN}$CONNECT_ARN${NC}"
echo -e "   Disconnect function: ${GREEN}$DISCONNECT_ARN${NC}"

# ============================================================
# Check for existing integrations
# ============================================================

echo -e "${YELLOW}3. Checking for existing integrations...${NC}"

EXISTING_ROUTES=$(aws apigatewayv2 get-routes --api-id $API_ID --query 'Items[].RouteKey' --output text 2>/dev/null || echo "")

if [[ "$EXISTING_ROUTES" == *"\$connect"* ]] || [[ "$EXISTING_ROUTES" == *"\$disconnect"* ]]; then
    echo -e "${YELLOW}   Warning: Routes already exist!${NC}"
    read -p "   Do you want to recreate them? (yes/no): " recreate
    if [ "$recreate" != "yes" ]; then
        echo "Skipping route creation."
        exit 0
    fi

    # Delete existing routes
    echo -e "   Deleting existing routes..."
    for route_id in $(aws apigatewayv2 get-routes --api-id $API_ID \
        --query 'Items[?RouteKey==`$connect` || RouteKey==`$disconnect`].RouteId' \
        --output text); do
        aws apigatewayv2 delete-route --api-id $API_ID --route-id $route_id 2>/dev/null || true
    done
fi

# ============================================================
# Create Integrations
# ============================================================

echo -e "${YELLOW}4. Creating Lambda integrations...${NC}"

# Create $connect integration
CONNECT_INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id $API_ID \
  --integration-type AWS_PROXY \
  --integration-uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${CONNECT_ARN}/invocations" \
  --query 'IntegrationId' \
  --output text)

echo -e "   Connect integration: ${GREEN}$CONNECT_INTEGRATION_ID${NC}"

# Create $disconnect integration
DISCONNECT_INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id $API_ID \
  --integration-type AWS_PROXY \
  --integration-uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${DISCONNECT_ARN}/invocations" \
  --query 'IntegrationId' \
  --output text)

echo -e "   Disconnect integration: ${GREEN}$DISCONNECT_INTEGRATION_ID${NC}"

# ============================================================
# Create Routes
# ============================================================

echo -e "${YELLOW}5. Creating WebSocket routes...${NC}"

# Create $connect route
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key '$connect' \
  --authorization-type NONE \
  --target "integrations/$CONNECT_INTEGRATION_ID" \
  > /dev/null

echo -e "   ${GREEN}✓${NC} \$connect route created"

# Create $disconnect route
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key '$disconnect' \
  --authorization-type NONE \
  --target "integrations/$DISCONNECT_INTEGRATION_ID" \
  > /dev/null

echo -e "   ${GREEN}✓${NC} \$disconnect route created"

# ============================================================
# Grant Lambda Permissions
# ============================================================

echo -e "${YELLOW}6. Granting API Gateway permissions...${NC}"

# Grant permission for $connect
aws lambda add-permission \
  --function-name edulens-websocket-connect-$STAGE \
  --statement-id apigateway-websocket-connect-${RANDOM} \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
  > /dev/null 2>&1 || echo -e "   ${YELLOW}Note: Permission may already exist${NC}"

echo -e "   ${GREEN}✓${NC} Connect permission granted"

# Grant permission for $disconnect
aws lambda add-permission \
  --function-name edulens-websocket-disconnect-$STAGE \
  --statement-id apigateway-websocket-disconnect-${RANDOM} \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
  > /dev/null 2>&1 || echo -e "   ${YELLOW}Note: Permission may already exist${NC}"

echo -e "   ${GREEN}✓${NC} Disconnect permission granted"

# ============================================================
# Deploy API
# ============================================================

echo -e "${YELLOW}7. Deploying WebSocket API...${NC}"

aws apigatewayv2 create-deployment \
  --api-id $API_ID \
  --stage-name $STAGE \
  > /dev/null

echo -e "   ${GREEN}✓${NC} API deployed to stage: $STAGE"

# ============================================================
# Success!
# ============================================================

echo ""
echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}WebSocket Integration Complete!${NC}"
echo -e "${GREEN}===============================================${NC}"
echo ""
echo -e "WebSocket URL: ${GREEN}wss://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}${NC}"
echo ""
echo "Test connection:"
echo "  npm install -g wscat"
echo "  wscat -c wss://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"
echo ""
echo "View logs:"
echo "  aws logs tail /aws/lambda/edulens-websocket-connect-$STAGE --follow"
echo ""
