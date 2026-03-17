#!/bin/bash
# deploy-agents-container.sh — Build ARM64 agent containers and deploy to AgentCore
#
# Usage: ./scripts/deploy-agents-container.sh [dev|staging|prod]
#
# Prerequisites:
#   - Node.js 20+, npm
#   - Docker with buildx (multi-platform builds)
#   - AWS CLI configured with appropriate permissions
#   - ECR repositories exist (created by CDK AgentCoreContainerStack)
#
# This script:
#   1. Builds TypeScript agents to dist/
#   2. Builds ARM64 Docker image with both agents
#   3. Tags and pushes to ECR repositories
#   4. Updates AgentCore Runtimes with new container images
#   5. Waits for READY status
#
# Key constraints:
#   - Container startup time must be < 30s (cold start limit)
#   - Must expose port 8080 with /ping and /invocations endpoints
#   - ARM64 platform required for AgentCore Runtime

set -euo pipefail

STAGE="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AGENTS_TS_DIR="$PROJECT_DIR/edulens-agents-ts"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION="${AWS_DEFAULT_REGION:-us-west-2}"

echo "🦞 EduLens Agent Container Deploy — Stage: $STAGE, Region: $REGION"

if [ ! -d "$AGENTS_TS_DIR" ]; then
  echo "❌ Error: TypeScript agents directory not found at $AGENTS_TS_DIR"
  echo "   Make sure you've created the TypeScript migration first."
  exit 1
fi

# --- ECR Repository URIs ---
PA_REPO_URI="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/edulens-parent-advisor-${STAGE}"
ST_REPO_URI="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/edulens-student-tutor-${STAGE}"

echo "📦 Building TypeScript agents..."
cd "$AGENTS_TS_DIR"

# Install dependencies and build
npm ci --production=false
npm run clean
npm run build

# Verify build output
if [ ! -f "dist/agents/parent-advisor.js" ] || [ ! -f "dist/agents/student-tutor.js" ]; then
  echo "❌ Build failed - agent entry points not found in dist/"
  exit 1
fi

echo "✅ TypeScript build complete"

echo ""
echo "🔐 Authenticating with ECR..."
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

echo ""
echo "🏗️  Building ARM64 container images..."

# Build Parent Advisor image
echo "   Building Parent Advisor..."
docker buildx build \
  --platform linux/arm64 \
  --build-arg AGENT_TYPE=parent-advisor \
  -t "edulens-parent-advisor:${STAGE}" \
  -t "${PA_REPO_URI}:latest" \
  -t "${PA_REPO_URI}:${STAGE}-$(date +%Y%m%d-%H%M%S)" \
  .

# Build Student Tutor image (same Dockerfile, different AGENT_TYPE default)
echo "   Building Student Tutor..."
docker buildx build \
  --platform linux/arm64 \
  --build-arg AGENT_TYPE=student-tutor \
  -t "edulens-student-tutor:${STAGE}" \
  -t "${ST_REPO_URI}:latest" \
  -t "${ST_REPO_URI}:${STAGE}-$(date +%Y%m%d-%H%M%S)" \
  .

echo ""
echo "☁️  Pushing images to ECR..."

# Push Parent Advisor
echo "   Pushing Parent Advisor to $PA_REPO_URI..."
docker push "${PA_REPO_URI}:latest"
docker push "${PA_REPO_URI}:${STAGE}-$(date +%Y%m%d-%H%M%S)"

# Push Student Tutor
echo "   Pushing Student Tutor to $ST_REPO_URI..."
docker push "${ST_REPO_URI}:latest"
docker push "${ST_REPO_URI}:${STAGE}-$(date +%Y%m%d-%H%M%S)"

echo "✅ Images pushed successfully"

# --- Update AgentCore Runtimes ---
echo ""
echo "🔄 Updating AgentCore Runtimes with new container images..."

# Get runtime IDs
PA_RUNTIME_ID=$(aws bedrock-agentcore-control list-agent-runtimes --region "$REGION" \
  --query "agentRuntimeSummaries[?starts_with(agentRuntimeName, 'edulens_parent_advisor_${STAGE}')].agentRuntimeId" \
  --output text 2>/dev/null | head -1)

ST_RUNTIME_ID=$(aws bedrock-agentcore-control list-agent-runtimes --region "$REGION" \
  --query "agentRuntimeSummaries[?starts_with(agentRuntimeName, 'edulens_student_tutor_${STAGE}')].agentRuntimeId" \
  --output text 2>/dev/null | head -1)

if [ -z "$PA_RUNTIME_ID" ] || [ "$PA_RUNTIME_ID" == "None" ]; then
  echo "⚠️  Warning: Parent Advisor runtime not found. Deploy CDK stack first?"
else
  echo "   Updating Parent Advisor runtime: $PA_RUNTIME_ID"
  aws bedrock-agentcore-control update-agent-runtime \
    --agent-runtime-id "$PA_RUNTIME_ID" \
    --agent-runtime-artifact "{\"containerConfiguration\":{\"imageUri\":\"${PA_REPO_URI}:latest\"}}" \
    --role-arn "arn:aws:iam::${ACCOUNT}:role/edulens-agentcore-runtime-role-${STAGE}" \
    --network-configuration '{"networkMode":"PUBLIC"}' \
    --environment-variables "MODEL_ID=us.anthropic.claude-sonnet-4-20250514-v1:0,MEMORY_ID=edulens_memory_${STAGE}-fkjwsj2f5b,STAGE=${STAGE},AGENT_TYPE=parent-advisor,NODE_ENV=production" \
    --region "$REGION" --query 'status' --output text
fi

if [ -z "$ST_RUNTIME_ID" ] || [ "$ST_RUNTIME_ID" == "None" ]; then
  echo "⚠️  Warning: Student Tutor runtime not found. Deploy CDK stack first?"
else
  echo "   Updating Student Tutor runtime: $ST_RUNTIME_ID"
  aws bedrock-agentcore-control update-agent-runtime \
    --agent-runtime-id "$ST_RUNTIME_ID" \
    --agent-runtime-artifact "{\"containerConfiguration\":{\"imageUri\":\"${ST_REPO_URI}:latest\"}}" \
    --role-arn "arn:aws:iam::${ACCOUNT}:role/edulens-agentcore-runtime-role-${STAGE}" \
    --network-configuration '{"networkMode":"PUBLIC"}' \
    --environment-variables "MODEL_ID=us.anthropic.claude-sonnet-4-20250514-v1:0,MEMORY_ID=edulens_memory_${STAGE}-fkjwsj2f5b,STAGE=${STAGE},AGENT_TYPE=student-tutor,NODE_ENV=production" \
    --region "$REGION" --query 'status' --output text
fi

echo ""
echo "⏳ Runtimes updating — waiting for READY status..."

# Wait for Parent Advisor
if [ -n "$PA_RUNTIME_ID" ] && [ "$PA_RUNTIME_ID" != "None" ]; then
  echo "   Waiting for Parent Advisor ($PA_RUNTIME_ID)..."
  while true; do
    STATUS=$(aws bedrock-agentcore-control get-agent-runtime \
      --agent-runtime-id "$PA_RUNTIME_ID" \
      --region "$REGION" \
      --query 'status' --output text 2>/dev/null || echo "UNKNOWN")

    echo "     Status: $STATUS"
    if [ "$STATUS" == "READY" ]; then
      echo "   ✅ Parent Advisor runtime ready"
      break
    elif [ "$STATUS" == "FAILED" ]; then
      echo "   ❌ Parent Advisor runtime failed"
      break
    fi
    sleep 10
  done
fi

# Wait for Student Tutor
if [ -n "$ST_RUNTIME_ID" ] && [ "$ST_RUNTIME_ID" != "None" ]; then
  echo "   Waiting for Student Tutor ($ST_RUNTIME_ID)..."
  while true; do
    STATUS=$(aws bedrock-agentcore-control get-agent-runtime \
      --agent-runtime-id "$ST_RUNTIME_ID" \
      --region "$REGION" \
      --query 'status' --output text 2>/dev/null || echo "UNKNOWN")

    echo "     Status: $STATUS"
    if [ "$STATUS" == "READY" ]; then
      echo "   ✅ Student Tutor runtime ready"
      break
    elif [ "$STATUS" == "FAILED" ]; then
      echo "   ❌ Student Tutor runtime failed"
      break
    fi
    sleep 10
  done
fi

echo ""
echo "✅ Container deployment complete!"
echo ""
echo "📊 Summary:"
echo "   Parent Advisor: ${PA_REPO_URI}:latest"
echo "   Student Tutor:  ${ST_REPO_URI}:latest"
echo ""
echo "🧪 Test with:"
echo "   aws bedrock-agent-runtime invoke-agent-runtime \\"
echo "     --agent-runtime-id $PA_RUNTIME_ID \\"
echo "     --endpoint-name edulens_parent_advisor_ep_${STAGE} \\"
echo "     --request-body '{\"prompt\":\"How is Mia doing?\",\"studentId\":\"mock-student-001\"}' \\"
echo "     --region $REGION /tmp/agent-response.json"
echo ""
echo "🚀 Ready for testing!"