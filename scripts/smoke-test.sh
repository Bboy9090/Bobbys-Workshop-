#!/bin/bash
# smoke-test.sh - Core MVP feature smoke tests
# Part of Bobby's Workshop MVP validation suite

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Print header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Bobby's Workshop - Smoke Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Helper functions
test_start() {
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -n "[$TESTS_TOTAL] $1... "
}

test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✓ PASS${NC}"
}

test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}✗ FAIL${NC}"
    if [ -n "$1" ]; then
        echo -e "    ${RED}Error: $1${NC}"
    fi
}

test_skip() {
    echo -e "${YELLOW}⊘ SKIP${NC}"
    if [ -n "$1" ]; then
        echo -e "    ${YELLOW}Reason: $1${NC}"
    fi
}

# 1. Test build succeeds
test_start "Build succeeds (npm run build)"
if npm run build &> /tmp/smoke-test-build.log; then
    test_pass
else
    test_fail "Build failed (see /tmp/smoke-test-build.log)"
fi

# 2. Test dist/ directory created
test_start "dist/ directory created"
if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
    test_pass
else
    test_fail "dist/ is empty or doesn't exist"
fi

# 3. Test index.html in dist
test_start "dist/index.html exists"
if [ -f "dist/index.html" ]; then
    test_pass
else
    test_fail "dist/index.html not found"
fi

# 4. Test assets bundled
test_start "dist/assets/ contains bundles"
if [ -d "dist/assets" ] && [ "$(ls -A dist/assets/*.js 2>/dev/null | wc -l)" -gt 0 ]; then
    test_pass
else
    test_fail "No JS bundles found in dist/assets/"
fi

# 5. Test CSS bundled
test_start "dist/assets/ contains CSS"
if [ -d "dist/assets" ] && [ "$(ls -A dist/assets/*.css 2>/dev/null | wc -l)" -gt 0 ]; then
    test_pass
else
    test_fail "No CSS bundles found in dist/assets/"
fi

# 6. Test linting passes
test_start "Linting passes (npm run lint)"
if npm run lint &> /tmp/smoke-test-lint.log; then
    test_pass
else
    test_fail "Linting failed (see /tmp/smoke-test-lint.log)"
fi

# 7. Test TypeScript compilation (if tsc available)
test_start "TypeScript compilation check"
if command -v npx &> /dev/null; then
    if npx tsc --noEmit &> /tmp/smoke-test-tsc.log; then
        test_pass
    else
        test_fail "TypeScript errors found (see /tmp/smoke-test-tsc.log)"
    fi
else
    test_skip "npx not available"
fi

# 8. Test workflow JSON files are valid
test_start "Workflow JSON files are valid"
INVALID_JSON=0
if [ -d "workflows" ]; then
    for json_file in workflows/*.json; do
        if [ -f "$json_file" ]; then
            if ! node -e "JSON.parse(require('fs').readFileSync('$json_file', 'utf8'))" &> /dev/null; then
                INVALID_JSON=1
                echo -e "\n    ${RED}Invalid JSON: $json_file${NC}"
            fi
        fi
    done

    if [ $INVALID_JSON -eq 0 ]; then
        test_pass
    else
        test_fail "Some workflow JSON files are invalid"
    fi
else
    test_skip "workflows/ directory not found"
fi

# 9. Test app.metadata.json structure
test_start "app.metadata.json has required fields"
if [ -f "app.metadata.json" ]; then
    REQUIRED_FIELDS=("id" "name" "version" "capabilities" "safety")
    MISSING_FIELDS=0

    for field in "${REQUIRED_FIELDS[@]}"; do
        if ! grep -q "\"$field\":" app.metadata.json; then
            MISSING_FIELDS=1
            echo -e "\n    ${RED}Missing field: $field${NC}"
        fi
    done

    if [ $MISSING_FIELDS -eq 0 ]; then
        test_pass
    else
        test_fail "Required fields missing in app.metadata.json"
    fi
else
    test_fail "app.metadata.json not found"
fi

# 10. Test MVP features defined
test_start "MVP features defined in metadata"
if [ -f "app.metadata.json" ]; then
    if grep -q '"mvpFeatures"' app.metadata.json; then
        test_pass
    else
        test_fail "mvpFeatures not defined in app.metadata.json"
    fi
else
    test_fail "app.metadata.json not found"
fi

# 11. Test no secrets in git (skip binaries)
test_start "No .env secrets in git tracked files"
SECRETS_FOUND=0
if [ -d ".git" ]; then
    # Check for .env files (excluding .env.example)
    if git ls-files | grep -E '^\.env$' > /dev/null; then
        SECRETS_FOUND=1
    fi

    if [ $SECRETS_FOUND -eq 0 ]; then
        test_pass
    else
        test_fail ".env files found in git (should use .env.example only)"
    fi
else
    test_skip "Not a git repository"
fi

# 12. Test README has build instructions
test_start "README has build instructions"
if [ -f "README.md" ]; then
    if grep -q "npm run build" README.md; then
        test_pass
    else
        test_fail "README.md missing build instructions"
    fi
else
    test_fail "README.md not found"
fi

# 13. Test package.json has required scripts
test_start "package.json has required scripts"
if [ -f "package.json" ]; then
    REQUIRED_SCRIPTS=("build" "test" "lint" "dev")
    MISSING_SCRIPTS=0

    for script in "${REQUIRED_SCRIPTS[@]}"; do
        if ! grep -q "\"$script\":" package.json; then
            MISSING_SCRIPTS=1
            echo -e "\n    ${RED}Missing script: $script${NC}"
        fi
    done

    if [ $MISSING_SCRIPTS -eq 0 ]; then
        test_pass
    else
        test_fail "Required scripts missing in package.json"
    fi
else
    test_fail "package.json not found"
fi

# 14. Test Tauri config exists (if Tauri project)
test_start "Tauri config valid (if applicable)"
if [ -f "src-tauri/tauri.conf.json" ]; then
    if node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json', 'utf8'))" &> /dev/null; then
        test_pass
    else
        test_fail "src-tauri/tauri.conf.json is invalid JSON"
    fi
else
    test_skip "Not a Tauri project"
fi

# 15. Test no node_modules committed
test_start "node_modules not committed to git"
if [ -d ".git" ]; then
    if git ls-files | grep -q "node_modules/"; then
        test_fail "node_modules found in git"
    else
        test_pass
    fi
else
    test_skip "Not a git repository"
fi

# 16. Test no dist committed
test_start "dist/ not committed to git"
if [ -d ".git" ]; then
    if git ls-files | grep -q "^dist/"; then
        test_fail "dist/ found in git"
    else
        test_pass
    fi
else
    test_skip "Not a git repository"
fi

# 17. Test .gitignore exists
test_start ".gitignore exists"
if [ -f ".gitignore" ]; then
    test_pass
else
    test_fail ".gitignore not found"
fi

# 18. Test .gitignore excludes common artifacts
test_start ".gitignore excludes artifacts"
if [ -f ".gitignore" ]; then
    MISSING_PATTERNS=0
    PATTERNS=("node_modules" "dist")

    for pattern in "${PATTERNS[@]}"; do
        if ! grep -q "$pattern" .gitignore; then
            MISSING_PATTERNS=1
            echo -e "\n    ${YELLOW}Pattern not in .gitignore: $pattern${NC}"
        fi
    done

    if [ $MISSING_PATTERNS -eq 0 ]; then
        test_pass
    else
        test_fail "Some patterns missing in .gitignore"
    fi
else
    test_fail ".gitignore not found"
fi

# 19. Test documentation files exist
test_start "Required documentation exists"
DOCS=("docs/PRD.md" "docs/ROADMAP.md" "docs/RELEASE_CHECKLIST.md" "docs/APP_CONTRACT.md" "packaging/README.md")
MISSING_DOCS=0

for doc in "${DOCS[@]}"; do
    if [ ! -f "$doc" ]; then
        MISSING_DOCS=1
        echo -e "\n    ${RED}Missing: $doc${NC}"
    fi
done

if [ $MISSING_DOCS -eq 0 ]; then
    test_pass
else
    test_fail "Some required documentation missing"
fi

# 20. Test all documentation is non-empty
test_start "Documentation files are non-empty"
EMPTY_DOCS=0

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ] && [ ! -s "$doc" ]; then
        EMPTY_DOCS=1
        echo -e "\n    ${RED}Empty file: $doc${NC}"
    fi
done

if [ $EMPTY_DOCS -eq 0 ]; then
    test_pass
else
    test_fail "Some documentation files are empty"
fi

# Print summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Smoke Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total tests:   $TESTS_TOTAL"
echo -e "${GREEN}Passed:        $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed:        $TESTS_FAILED${NC}"
else
    echo -e "Failed:        0"
fi
echo ""

# Exit with appropriate code
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Smoke Tests FAILED${NC}"
    echo -e "${YELLOW}Fix the failed tests and re-run smoke tests${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Smoke Tests PASSED${NC}"
    echo -e "${GREEN}All smoke tests completed successfully!${NC}"
    exit 0
fi
