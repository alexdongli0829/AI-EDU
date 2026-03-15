#!/usr/bin/env bash
# setup-deploy.sh
#
# Run this once on any new server before `cdk deploy`.
# Installs all backend workspace dependencies and generates Prisma clients
# with the Lambda-compatible binary target (rhel-openssl-3.0.x).
#
# Usage:
#   cd edulens-backend
#   bash scripts/setup-deploy.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

cd "$ROOT"
echo "Working in: $ROOT"

# ── 1. Ensure pnpm is available ───────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi
echo "pnpm $(pnpm --version)"

# ── 2. Install all workspace dependencies ────────────────────────────────────
echo ""
echo "Installing workspace packages with pnpm..."
pnpm install

echo ""
echo "Setup complete. You can now run cdk deploy from edulens-infrastructure/:"
echo "  cd ../edulens-infrastructure && npx cdk deploy --all --require-approval never"
