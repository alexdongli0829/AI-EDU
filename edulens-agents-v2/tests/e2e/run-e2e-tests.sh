#!/bin/bash
# E2E Test Runner for EduLens v2
# Usage: ./run-e2e-tests.sh [scenario_id]

BASE_URL="http://localhost:8080"
RESULTS_DIR="/home/ec2-user/AI-EDU/edulens-agents-v2/tests/e2e/results"
mkdir -p "$RESULTS_DIR"

invoke() {
  local scenario="$1"
  local payload="$2"
  echo "--- $scenario ---"
  local result=$(curl -s -X POST "$BASE_URL/invocations" \
    -H 'Content-Type: application/json' \
    -d "$payload" 2>&1)
  echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
  echo "$result" >> "$RESULTS_DIR/${scenario}.json"
  echo ""
}

echo "=== EduLens v2 E2E Test Run $(date -u) ==="
echo ""

# C1: Student tries parent domain
echo "=== CATEGORY C: RBAC ==="
invoke "C1-student-parent-domain" '{
  "prompt": "How is my child doing?",
  "domain": "parent_advisor",
  "actorId": "stu-001",
  "role": "student",
  "sessionId": "test-c1"
}'

# C4: Missing auth
invoke "C4-missing-auth" '{
  "prompt": "Show me test results"
}'

echo "=== Done ==="
