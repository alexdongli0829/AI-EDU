#!/bin/bash
# deploy-agents.sh — Build ARM64 agent packages and upload to S3
#
# Usage: ./scripts/deploy-agents.sh [dev|staging|prod]
#
# Prerequisites:
#   - Python 3.12+ (pip install with --platform requires pip >=21.0)
#   - AWS CLI configured with appropriate permissions
#   - S3 bucket exists (created by CDK AgentCoreStack)
#
# This script:
#   1. Installs ARM64 Python packages (AgentCore Runtime runs ARM64 Linux)
#   2. Trims botocore to essential services (417 → ~10, saves 20MB)
#   3. Preserves opentelemetry .dist-info (required for entry_points)
#   4. Bundles agent source code (agents/, tools/, guardrails/)
#   5. Uploads to S3 as parent-advisor/code.zip and student-tutor/code.zip
#
# Key constraints:
#   - 30s cold start limit → zip must be < 15MB
#   - Runtime only has pip pre-installed → ALL deps must be in zip
#   - ARM64 binary wheels required (--platform manylinux2014_aarch64)

set -euo pipefail

STAGE="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AGENTS_DIR="$PROJECT_DIR/edulens-agents"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
BUCKET="edulens-agent-code-${STAGE}-${ACCOUNT}"
REGION="${AWS_DEFAULT_REGION:-us-west-2}"

echo "🦞 EduLens Agent Deploy — Stage: $STAGE, Bucket: $BUCKET, Region: $REGION"

# --- Build ---
BUILD_DIR=$(mktemp -d)
trap "rm -rf $BUILD_DIR" EXIT

echo "📦 Installing ARM64 packages..."
pip install \
  --platform manylinux2014_aarch64 \
  --target "$BUILD_DIR" \
  --python-version 3.12 \
  --only-binary=:all: \
  --implementation cp \
  bedrock-agentcore>=1.0.0 \
  strands-agents>=0.3.0 \
  2>&1 | tail -3

echo "✂️  Trimming botocore service models..."
KEEP_SERVICES="bedrock bedrock-agent bedrock-agent-runtime bedrock-agentcore bedrock-agentcore-control bedrock-runtime sts s3 secretsmanager"
if [ -d "$BUILD_DIR/botocore/data" ]; then
  cd "$BUILD_DIR/botocore/data"
  for dir in */; do
    service="${dir%/}"
    keep=false
    for s in $KEEP_SERVICES; do
      if [ "$service" = "$s" ]; then keep=true; break; fi
    done
    [ "$keep" = "false" ] && rm -rf "$dir"
  done
  cd "$BUILD_DIR"
fi

echo "🧹 Cleaning up metadata (preserving opentelemetry dist-info)..."
find "$BUILD_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -name "*.pyc" -delete 2>/dev/null || true
# Remove dist-info EXCEPT opentelemetry (needed for entry_points)
find "$BUILD_DIR" -name "*.dist-info" -type d | grep -v opentelemetry | xargs rm -rf 2>/dev/null || true

echo "📋 Copying agent source code..."
cp -r "$AGENTS_DIR/agents/" "$BUILD_DIR/"
cp -r "$AGENTS_DIR/tools/" "$BUILD_DIR/"
cp -r "$AGENTS_DIR/guardrails/" "$BUILD_DIR/"
find "$BUILD_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

echo "📦 Creating zip..."
ZIP_FILE=$(mktemp).zip
cd "$BUILD_DIR"
zip -r -q "$ZIP_FILE" .
ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
echo "   Zip size: $ZIP_SIZE"

if [ "$(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE" 2>/dev/null)" -gt 52428800 ]; then
  echo "⚠️  WARNING: Zip > 50MB — may cause cold start timeout (30s limit)"
fi

echo "☁️  Uploading to S3..."
aws s3 cp "$ZIP_FILE" "s3://$BUCKET/parent-advisor/code.zip" --region "$REGION"
aws s3 cp "$ZIP_FILE" "s3://$BUCKET/student-tutor/code.zip" --region "$REGION"

echo ""
echo "✅ Done! Agent code uploaded to s3://$BUCKET/"
echo "   parent-advisor/code.zip ($ZIP_SIZE)"
echo "   student-tutor/code.zip ($ZIP_SIZE)"
echo ""
echo "To deploy: cd edulens-infrastructure && npx cdk deploy EduLensAgentCoreStack-${STAGE}"
