#!/bin/bash

# OpenLoop Research Assistant - Production Readiness Check

echo "🔍 OpenLoop Production Readiness Check"
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

pass_check() {
    echo -e "${GREEN}✅ $1${NC}"
    PASSED=$((PASSED + 1))
}

fail_check() {
    echo -e "${RED}❌ $1${NC}"
    FAILED=$((FAILED + 1))
}

warn_check() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo ""
echo "📁 File Structure Check"
echo "----------------------"

# Check critical files exist
if [ -f "backend/src/agent/app.py" ]; then
    pass_check "Backend app.py exists"
else
    fail_check "Backend app.py missing"
fi

if [ -f "frontend/src/App.tsx" ]; then
    pass_check "Frontend App.tsx exists"
else
    fail_check "Frontend App.tsx missing"  
fi

if [ -f "docker-compose.yml" ]; then
    pass_check "docker-compose.yml exists"
else
    fail_check "docker-compose.yml missing"
fi

if [ -f "Dockerfile" ]; then
    pass_check "Dockerfile exists"
else
    fail_check "Dockerfile missing"
fi

echo ""
echo "🔧 Environment Check"
echo "--------------------"

if [ -f "backend/.env.example" ]; then
    pass_check ".env.example exists"
else
    fail_check ".env.example missing"
fi

# Check environment variables (either from .env file or system)
if [ -f "backend/.env" ]; then
    pass_check ".env file exists"
    
    if grep -q "OPENAI_API_KEY=" "backend/.env" && ! grep -q "OPENAI_API_KEY=$" "backend/.env" && ! grep -q "your_openai_api_key" "backend/.env"; then
        pass_check "OPENAI_API_KEY is set in .env"
    else
        # Check system environment as fallback
        if [ ! -z "$OPENAI_API_KEY" ]; then
            pass_check "OPENAI_API_KEY found in environment"
        else
            fail_check "OPENAI_API_KEY not set (neither .env nor environment)"
        fi
    fi
    
    if grep -q "TAVILY_API_KEY=" "backend/.env"; then
        if ! grep -q "TAVILY_API_KEY=$" "backend/.env" && ! grep -q "your_tavily_api_key" "backend/.env"; then
            pass_check "TAVILY_API_KEY is set in .env"
        else
            if [ ! -z "$TAVILY_API_KEY" ]; then
                pass_check "TAVILY_API_KEY found in environment"
            else
                fail_check "TAVILY_API_KEY is required for web search functionality"
            fi
        fi
    else
        if [ ! -z "$TAVILY_API_KEY" ]; then
            pass_check "TAVILY_API_KEY found in environment"
        else
            fail_check "TAVILY_API_KEY is required but not configured"
        fi
    fi
else
    # No .env file - check system environment
    if [ ! -z "$OPENAI_API_KEY" ]; then
        pass_check "OPENAI_API_KEY found in system environment"
    else
        fail_check "OPENAI_API_KEY not found (create .env or export to environment)"
    fi
    
    if [ ! -z "$TAVILY_API_KEY" ]; then
        pass_check "TAVILY_API_KEY found in system environment"
    else
        warn_check "TAVILY_API_KEY not found (optional - for real web search)"
    fi
fi

echo ""
echo "🧹 Code Cleanliness Check"
echo "------------------------"

# Check for build artifacts
if [ -d "backend/build" ]; then
    fail_check "Build artifacts found"
else
    pass_check "No build artifacts"
fi

if find backend -name "__pycache__" -type d 2>/dev/null | grep -q .; then
    fail_check "__pycache__ directories found"
else
    pass_check "No __pycache__ directories"
fi

if find backend -name "*.egg-info" -type d 2>/dev/null | grep -q .; then
    fail_check "*.egg-info directories found"
else
    pass_check "No *.egg-info directories"
fi

# Check for multi-agent remnants
if grep -r "multi_agent\|multi-agent" backend/src 2>/dev/null | grep -v "__pycache__" | grep -q .; then
    fail_check "Multi-agent code still found"
else
    pass_check "No multi-agent code"
fi

echo ""
echo "📦 Dependencies Check"
echo "--------------------"

if [ -f "backend/pyproject.toml" ]; then
    pass_check "Backend pyproject.toml exists"
else
    fail_check "Backend pyproject.toml missing"
fi

if [ -f "frontend/package.json" ]; then
    pass_check "Frontend package.json exists"
else
    fail_check "Frontend package.json missing"
fi

echo ""
echo "🔒 Security Check"
echo "----------------"

if [ -f ".gitignore" ]; then
    pass_check ".gitignore exists"
    
    if grep -q ".env" ".gitignore"; then
        pass_check ".env is ignored"
    else
        fail_check ".env not ignored - security risk!"
    fi
else
    fail_check ".gitignore missing"
fi

echo ""
echo "📊 Results Summary"
echo "=================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Production readiness check PASSED!${NC}"
    echo "Ready for deployment with: ./deploy.sh"
    exit 0
else
    echo -e "${RED}❌ Production readiness check FAILED!${NC}"
    echo "Please fix the issues above."
    exit 1
fi
