#!/bin/bash

# EduLens Infrastructure Deployment Script
# Usage: ./deploy.sh [stage] [action]
#   stage: dev, staging, prod (default: dev)
#   action: bootstrap, diff, deploy, destroy (default: deploy)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
STAGE=${1:-dev}
ACTION=${2:-deploy}

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}EduLens Infrastructure Deployment${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo -e "Stage: ${YELLOW}$STAGE${NC}"
echo -e "Action: ${YELLOW}$ACTION${NC}"
echo ""

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured!${NC}"
    echo ""
    echo "Please configure AWS credentials using one of these methods:"
    echo "  1. aws configure"
    echo "  2. export AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
    echo "  3. aws sso login --profile your-profile && export AWS_PROFILE=your-profile"
    exit 1
fi

# Get AWS account info
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-west-2")

echo -e "${GREEN}AWS Account:${NC} $ACCOUNT_ID"
echo -e "${GREEN}Region:${NC} $REGION"
echo ""

# Confirm production deployments
if [ "$STAGE" = "prod" ]; then
    echo -e "${YELLOW}WARNING: You are about to deploy to PRODUCTION!${NC}"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

# Execute action
case $ACTION in
    bootstrap)
        echo -e "${GREEN}Bootstrapping CDK...${NC}"
        npx cdk bootstrap aws://$ACCOUNT_ID/$REGION --context stage=$STAGE
        echo -e "${GREEN}Bootstrap complete!${NC}"
        ;;

    diff)
        echo -e "${GREEN}Showing differences...${NC}"
        npx cdk diff --all --context stage=$STAGE
        ;;

    deploy)
        echo -e "${GREEN}Deploying stacks...${NC}"

        # Check if bootstrap is needed
        if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
            echo -e "${YELLOW}CDK not bootstrapped. Running bootstrap first...${NC}"
            npx cdk bootstrap aws://$ACCOUNT_ID/$REGION --context stage=$STAGE
        fi

        # Deploy all stacks
        echo ""
        echo -e "${GREEN}Deploying all stacks to $STAGE...${NC}"
        npx cdk deploy --all --context stage=$STAGE --require-approval never

        echo ""
        echo -e "${GREEN}==================================${NC}"
        echo -e "${GREEN}Deployment Complete!${NC}"
        echo -e "${GREEN}==================================${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Save the output values (API URLs, database endpoints, etc.)"
        echo "  2. Configure AWS Bedrock model access"
        echo "  3. Initialize database schema"
        echo "  4. Update frontend environment variables"
        echo "  5. Test API endpoints"
        echo ""
        echo "See DEPLOYMENT.md for detailed instructions."
        ;;

    destroy)
        echo -e "${RED}WARNING: This will destroy all resources!${NC}"
        read -p "Are you sure you want to destroy $STAGE environment? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo -e "${RED}Destroying stacks...${NC}"
            npx cdk destroy --all --context stage=$STAGE --force
            echo -e "${GREEN}Destroy complete!${NC}"
        else
            echo "Destroy cancelled."
        fi
        ;;

    list)
        echo -e "${GREEN}Listing stacks...${NC}"
        npx cdk list --context stage=$STAGE
        ;;

    synth)
        echo -e "${GREEN}Synthesizing CloudFormation templates...${NC}"
        npx cdk synth --context stage=$STAGE
        ;;

    *)
        echo -e "${RED}Unknown action: $ACTION${NC}"
        echo ""
        echo "Valid actions:"
        echo "  bootstrap - Bootstrap CDK in your AWS account"
        echo "  diff      - Show what will change"
        echo "  deploy    - Deploy all stacks"
        echo "  destroy   - Destroy all stacks"
        echo "  list      - List all stacks"
        echo "  synth     - Synthesize CloudFormation templates"
        echo ""
        echo "Usage: ./deploy.sh [stage] [action]"
        echo "  Example: ./deploy.sh dev deploy"
        exit 1
        ;;
esac
