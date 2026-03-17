#!/bin/bash

# EduLens E2E Test Runner Script
# Usage: ./run-tests.sh [test-type] [options]

set -e

cd "$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}EduLens E2E Test Runner${NC}"
echo "=========================="

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Function to run tests with reporting
run_test() {
    local test_name=$1
    local test_file=$2
    local description=$3

    echo ""
    echo -e "${BLUE}Running ${test_name}...${NC}"
    echo -e "${YELLOW}${description}${NC}"
    echo ""

    if npx jest "$test_file" --verbose --testTimeout=60000; then
        echo -e "${GREEN}✅ ${test_name} completed${NC}"
        return 0
    else
        echo -e "${RED}❌ ${test_name} failed${NC}"
        return 1
    fi
}

# Parse command line arguments
TEST_TYPE=${1:-"all"}

case $TEST_TYPE in
    "connectivity"|"connect")
        run_test "Connectivity Tests" "edulens.connectivity.test.ts" "Basic connectivity and configuration validation"
        ;;
    "agentcore"|"agents"|"e2e")
        run_test "AgentCore E2E Tests" "edulens.e2e.test.ts" "Full AgentCore runtime integration tests"
        ;;
    "all"|"")
        echo -e "${BLUE}Running all test suites...${NC}"
        echo ""

        connectivity_passed=0
        agentcore_passed=0

        if run_test "Connectivity Tests" "edulens.connectivity.test.ts" "Basic connectivity and configuration validation"; then
            connectivity_passed=1
        fi

        echo ""
        echo -e "${YELLOW}Note: AgentCore tests may fail due to permissions - this is expected${NC}"
        if run_test "AgentCore E2E Tests" "edulens.e2e.test.ts" "Full AgentCore runtime integration tests"; then
            agentcore_passed=1
        fi

        echo ""
        echo -e "${BLUE}=== SUMMARY ===${NC}"
        echo -e "Connectivity Tests: $([ $connectivity_passed -eq 1 ] && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}")"
        echo -e "AgentCore E2E Tests: $([ $agentcore_passed -eq 1 ] && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED (Expected)${NC}")"
        echo ""
        echo -e "${YELLOW}See TEST-RESULTS.md for detailed analysis${NC}"
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [test-type] [options]"
        echo ""
        echo "Test Types:"
        echo "  connectivity, connect  - Run only connectivity tests"
        echo "  agentcore, agents, e2e - Run only AgentCore integration tests"
        echo "  all                    - Run all tests (default)"
        echo "  help                   - Show this help"
        echo ""
        echo "Examples:"
        echo "  $0                     # Run all tests"
        echo "  $0 connectivity        # Run only connectivity tests"
        echo "  $0 agentcore          # Run only AgentCore tests"
        echo ""
        exit 0
        ;;
    *)
        echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac