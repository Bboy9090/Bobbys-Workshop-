#!/bin/bash
# healthcheck.sh - Verify diagnostics, export, and safe-mode functionality
# Part of Bobby's Workshop MVP validation suite

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_TOTAL=0

# Print header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Bobby's Workshop - Healthcheck${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Helper functions
check_start() {
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    echo -n "[$CHECKS_TOTAL] $1... "
}

check_pass() {
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
    echo -e "${GREEN}✓ PASS${NC}"
}

check_fail() {
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
    echo -e "${RED}✗ FAIL${NC}"
    if [ -n "$1" ]; then
        echo -e "    ${RED}Error: $1${NC}"
    fi
}

check_warn() {
    echo -e "${YELLOW}⚠ WARN${NC}"
    if [ -n "$1" ]; then
        echo -e "    ${YELLOW}Warning: $1${NC}"
    fi
}

# 1. Check Node.js availability
check_start "Node.js available"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    if [[ "$NODE_VERSION" =~ ^v([0-9]+) ]] && [ "${BASH_REMATCH[1]}" -ge 20 ]; then
        check_pass
    else
        check_fail "Node.js version $NODE_VERSION < v20 (required: v20+)"
    fi
else
    check_fail "Node.js not found in PATH"
fi

# 2. Check npm availability
check_start "npm available"
if command -v npm &> /dev/null; then
    check_pass
else
    check_fail "npm not found in PATH"
fi

# 3. Check package.json exists
check_start "package.json exists"
if [ -f "package.json" ]; then
    check_pass
else
    check_fail "package.json not found"
fi

# 4. Check app.metadata.json exists
check_start "app.metadata.json exists"
if [ -f "app.metadata.json" ]; then
    check_pass
else
    check_fail "app.metadata.json not found"
fi

# 5. Verify app.metadata.json structure
check_start "app.metadata.json valid JSON"
if command -v node &> /dev/null && [ -f "app.metadata.json" ]; then
    if node -e "JSON.parse(require('fs').readFileSync('app.metadata.json', 'utf8'))" &> /dev/null; then
        check_pass
    else
        check_fail "app.metadata.json is not valid JSON"
    fi
else
    check_fail "Cannot validate (Node.js or file missing)"
fi

# 6. Check safety settings in app.metadata.json
check_start "app.metadata.json safety settings"
if [ -f "app.metadata.json" ]; then
    if grep -q '"noDestructiveActions": true' app.metadata.json && \
       grep -q '"noBypassFlows": true' app.metadata.json && \
       grep -q '"dryRunDefault": true' app.metadata.json; then
        check_pass
    else
        check_fail "Safety settings not correctly configured"
    fi
else
    check_fail "app.metadata.json not found"
fi

# 7. Check documentation files
check_start "docs/PRD.md exists"
if [ -f "docs/PRD.md" ]; then
    check_pass
else
    check_fail "docs/PRD.md not found"
fi

check_start "docs/ROADMAP.md exists"
if [ -f "docs/ROADMAP.md" ]; then
    check_pass
else
    check_fail "docs/ROADMAP.md not found"
fi

check_start "docs/RELEASE_CHECKLIST.md exists"
if [ -f "docs/RELEASE_CHECKLIST.md" ]; then
    check_pass
else
    check_fail "docs/RELEASE_CHECKLIST.md not found"
fi

check_start "docs/APP_CONTRACT.md exists"
if [ -f "docs/APP_CONTRACT.md" ]; then
    check_pass
else
    check_fail "docs/APP_CONTRACT.md not found"
fi

check_start "packaging/README.md exists"
if [ -f "packaging/README.md" ]; then
    check_pass
else
    check_fail "packaging/README.md not found"
fi

# 8. Check dependencies installed
check_start "node_modules exists"
if [ -d "node_modules" ]; then
    check_pass
else
    check_warn "node_modules not found (run 'npm install')"
fi

# 9. Check workflow definitions
check_start "Workflow definitions exist"
if [ -d "workflows" ] && [ "$(ls -A workflows/*.json 2>/dev/null | wc -l)" -gt 0 ]; then
    check_pass
else
    check_warn "No workflow JSON files found in workflows/"
fi

# 10. Check workflow schema
check_start "Workflow schema exists"
if [ -f "workflows/workflow-schema.json" ]; then
    check_pass
else
    check_warn "workflows/workflow-schema.json not found"
fi

# 11. Check build output (if exists)
check_start "Build output (dist/) exists"
if [ -d "dist" ]; then
    check_pass
else
    check_warn "dist/ not found (run 'npm run build')"
fi

# 12. Check Tauri configuration
check_start "Tauri config exists"
if [ -f "src-tauri/tauri.conf.json" ]; then
    check_pass
else
    check_warn "src-tauri/tauri.conf.json not found"
fi

# 13. Check workshop server
check_start "Workshop server exists"
if [ -d "src-tauri/resources/server" ]; then
    check_pass
else
    check_warn "src-tauri/resources/server not found"
fi

# 14. Check for secrets in codebase
check_start "No .env files committed"
if git ls-files | grep -E '\.env$' | grep -v '\.env\.example' > /dev/null 2>&1; then
    check_fail "Found .env files in git (should use .env.example only)"
else
    check_pass
fi

# 15. Check git repository
check_start "Git repository initialized"
if [ -d ".git" ]; then
    check_pass
else
    check_warn ".git not found (not a git repository)"
fi

# 16. Check for pending git changes
check_start "Git status clean"
if [ -d ".git" ]; then
    if git diff-index --quiet HEAD -- 2>/dev/null; then
        check_pass
    else
        check_warn "Uncommitted changes in working directory"
    fi
else
    check_warn "Not a git repository"
fi

# 17. Check TypeScript configuration
check_start "tsconfig.json exists"
if [ -f "tsconfig.json" ]; then
    check_pass
else
    check_fail "tsconfig.json not found"
fi

# 18. Check Vite configuration
check_start "vite.config.ts exists"
if [ -f "vite.config.ts" ]; then
    check_pass
else
    check_fail "vite.config.ts not found"
fi

# 19. Check diagnostic capabilities in metadata
check_start "Diagnostic capability enabled"
if [ -f "app.metadata.json" ]; then
    if grep -q '"diagnostics": true' app.metadata.json; then
        check_pass
    else
        check_fail "Diagnostics capability not enabled in app.metadata.json"
    fi
else
    check_fail "app.metadata.json not found"
fi

# 20. Check export capability in metadata
check_start "Export reports capability enabled"
if [ -f "app.metadata.json" ]; then
    if grep -q '"exportReports": true' app.metadata.json; then
        check_pass
    else
        check_fail "Export reports capability not enabled in app.metadata.json"
    fi
else
    check_fail "app.metadata.json not found"
fi

# 21. Check safe mode capability in metadata
check_start "Safe mode capability enabled"
if [ -f "app.metadata.json" ]; then
    if grep -q '"safeMode": true' app.metadata.json; then
        check_pass
    else
        check_fail "Safe mode capability not enabled in app.metadata.json"
    fi
else
    check_fail "app.metadata.json not found"
fi

# 22. Check audit logging capability in metadata
check_start "Audit logging capability enabled"
if [ -f "app.metadata.json" ]; then
    if grep -q '"auditLogging": true' app.metadata.json; then
        check_pass
    else
        check_fail "Audit logging capability not enabled in app.metadata.json"
    fi
else
    check_fail "app.metadata.json not found"
fi

# Print summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Healthcheck Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total checks:  $CHECKS_TOTAL"
echo -e "${GREEN}Passed:        $CHECKS_PASSED${NC}"
if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed:        $CHECKS_FAILED${NC}"
else
    echo -e "Failed:        0"
fi
echo ""

# Exit with appropriate code
if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Healthcheck FAILED${NC}"
    echo -e "${YELLOW}Fix the failed checks and re-run healthcheck${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Healthcheck PASSED${NC}"
    echo -e "${GREEN}All critical checks passed successfully!${NC}"
    exit 0
fi
