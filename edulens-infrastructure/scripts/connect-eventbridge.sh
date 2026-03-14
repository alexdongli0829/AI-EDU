#!/bin/bash

# EventBridge Targets Setup Script
# Connects EventBridge rules to Lambda functions after deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

STAGE=${1:-dev}

echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}EventBridge Targets Setup${NC}"
echo -e "${GREEN}===============================================${NC}"
echo ""
echo -e "Stage: ${YELLOW}$STAGE${NC}"
echo ""

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured!${NC}"
    exit 1
fi

REGION=$(aws configure get region || echo "us-west-2")

echo -e "${GREEN}Region:${NC} $REGION"
echo ""

# ============================================================
# Get Lambda Function ARNs
# ============================================================

echo -e "${YELLOW}1. Getting Lambda function ARNs...${NC}"

PROFILE_CALC_ARN=$(aws lambda get-function \
  --function-name edulens-calculate-profile-$STAGE \
  --query 'Configuration.FunctionArn' \
  --output text 2>/dev/null)

TIMER_SYNC_ARN=$(aws lambda get-function \
  --function-name edulens-timer-sync-$STAGE \
  --query 'Configuration.FunctionArn' \
  --output text 2>/dev/null)

if [ -z "$PROFILE_CALC_ARN" ] || [ -z "$TIMER_SYNC_ARN" ]; then
    echo -e "${RED}Error: Could not find Lambda functions${NC}"
    echo "Make sure EduLensLambdaStack-$STAGE is deployed"
    exit 1
fi

echo -e "   Profile calculation: ${GREEN}$PROFILE_CALC_ARN${NC}"
echo -e "   Timer sync: ${GREEN}$TIMER_SYNC_ARN${NC}"

# ============================================================
# Get EventBridge Rule Names
# ============================================================

echo -e "${YELLOW}2. Getting EventBridge rule names...${NC}"

TEST_COMPLETED_RULE="edulens-test-completed-$STAGE"
TIMER_SYNC_RULE="edulens-timer-sync-$STAGE"

echo -e "   Test completed rule: ${GREEN}$TEST_COMPLETED_RULE${NC}"
echo -e "   Timer sync rule: ${GREEN}$TIMER_SYNC_RULE${NC}"

# ============================================================
# Check for existing targets
# ============================================================

echo -e "${YELLOW}3. Checking for existing targets...${NC}"

EXISTING_TARGETS=$(aws events list-targets-by-rule \
  --rule $TEST_COMPLETED_RULE \
  --query 'Targets[].Id' \
  --output text 2>/dev/null || echo "")

if [[ "$EXISTING_TARGETS" == *"ProfileCalculationTarget"* ]]; then
    echo -e "${YELLOW}   Warning: Targets already exist!${NC}"
    read -p "   Do you want to recreate them? (yes/no): " recreate
    if [ "$recreate" != "yes" ]; then
        echo "Skipping target creation."
        exit 0
    fi

    # Remove existing targets
    echo -e "   Removing existing targets..."
    aws events remove-targets \
      --rule $TEST_COMPLETED_RULE \
      --ids ProfileCalculationTarget 2>/dev/null || true

    aws events remove-targets \
      --rule $TIMER_SYNC_RULE \
      --ids TimerSyncTarget 2>/dev/null || true
fi

# ============================================================
# Add Targets to Rules
# ============================================================

echo -e "${YELLOW}4. Adding Lambda targets to EventBridge rules...${NC}"

# Add profile calculation target
aws events put-targets \
  --rule $TEST_COMPLETED_RULE \
  --targets "Id=ProfileCalculationTarget,Arn=$PROFILE_CALC_ARN" \
  > /dev/null

echo -e "   ${GREEN}✓${NC} Profile calculation target added to test.completed rule"

# Add timer sync target
aws events put-targets \
  --rule $TIMER_SYNC_RULE \
  --targets "Id=TimerSyncTarget,Arn=$TIMER_SYNC_ARN" \
  > /dev/null

echo -e "   ${GREEN}✓${NC} Timer sync target added to timer sync rule"

# ============================================================
# Success!
# ============================================================

echo ""
echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}EventBridge Targets Setup Complete!${NC}"
echo -e "${GREEN}===============================================${NC}"
echo ""
echo "Configured targets:"
echo "  • test.completed → calculate-profile Lambda"
echo "  • timer-sync (1 min) → timer-sync Lambda"
echo ""
echo "Verify targets:"
echo "  aws events list-targets-by-rule --rule $TEST_COMPLETED_RULE"
echo "  aws events list-targets-by-rule --rule $TIMER_SYNC_RULE"
echo ""
echo "Test profile calculation:"
echo "  # Complete a test, then check logs:"
echo "  aws logs tail /aws/lambda/edulens-calculate-profile-$STAGE --follow"
echo ""
