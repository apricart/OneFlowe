#!/usr/bin/env bash
#
# Complete Security Test Suite Runner
# Executes all security tests in sequence for CI/CD
#
# Usage: ./scripts/security/run-all-tests.sh
# Exit code: 0 = all passed, 1 = failures detected

set -e

echo "=================================="
echo "🔒 Security Test Suite"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Function to run test and track results
run_test() {
  local test_name="$1"
  local test_cmd="$2"
  
  echo -e "${YELLOW}Running: $test_name${NC}"
  
  if eval "$test_cmd"; then
    echo -e "${GREEN}✅ PASSED: $test_name${NC}"
  else
    echo -e "${RED}❌ FAILED: $test_name${NC}"
    FAILED=$((FAILED + 1))
  fi
  echo ""
}

# 1. Dependency Scanning
run_test "Dependency Security Scan" "npm run security:deps"

# 2. Unit Tests
run_test "Unit Tests" "npm run test:unit"

# 3. Security Tests
run_test "SQL Injection Tests" "npm run test:security -- sql-injection"
run_test "Auth Bypass Tests" "npm run test:security -- auth-bypass"
run_test "XSS Prevention Tests" "npm run test:security -- xss-attacks"
run_test "Data Integrity Tests" "npm run test:security -- data-integrity"

# 4. Infrastructure Security
run_test "HTTP Headers Tests" "npm run test:security:headers"
run_test "SSRF Prevention Tests" "npm run test:security:ssrf"
run_test "Log Safety Tests" "npm run test:security:logging"
run_test "Rate Limiting Tests" "npm run test:security:rate-limit"

# 5. Chaos Tests
run_test "Chaos Engineering Tests" "npm run test:chaos"

# 6. Integration Tests
run_test "API Integration Tests" "npm run test:integration"

echo "=================================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All security tests PASSED${NC}"
  echo "=================================="
  exit 0
else
  echo -e "${RED}❌ $FAILED test suite(s) FAILED${NC}"
  echo "=================================="
  exit 1
fi
