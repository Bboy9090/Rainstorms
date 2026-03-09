#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Rainstorms — Setup Verification Script
# Usage:  bash verify-setup.sh
# Purpose: Verify that your Rainstorms installation is ready to run
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

# ── Colour helpers ──────────────────────────────────────────────────────────
bold="\033[1m"; green="\033[0;32m"; yellow="\033[0;33m"; red="\033[0;31m"; blue="\033[0;34m"; reset="\033[0m"
success() { echo -e "${green}✓${reset} $*"; }
warn()    { echo -e "${yellow}⚠${reset} $*"; }
error()   { echo -e "${red}✗${reset} $*"; }
info()    { echo -e "${blue}ℹ${reset} $*"; }

echo -e "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
echo -e "${bold}  Rainstorms Setup Verification${reset}"
echo -e "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
echo ""

ISSUES=0

# ── Check Python ─────────────────────────────────────────────────────────────
echo -e "${bold}[1] Checking Python installation...${reset}"
if command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    success "Python found: $PYTHON_VERSION"

    # Check if version is 3.10+
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
    if [[ "$PYTHON_MAJOR" -ge 3 ]] && [[ "$PYTHON_MINOR" -ge 10 ]]; then
        success "Python version is compatible (3.10+)"
    else
        error "Python version is too old. Required: 3.10+, Found: $PYTHON_VERSION"
        ISSUES=$((ISSUES + 1))
    fi
else
    error "Python 3 not found. Install Python 3.10+ from https://www.python.org/"
    ISSUES=$((ISSUES + 1))
fi
echo ""

# ── Check Node ───────────────────────────────────────────────────────────────
echo -e "${bold}[2] Checking Node.js installation...${reset}"
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version 2>&1 | cut -d'v' -f2)
    success "Node.js found: v$NODE_VERSION"

    # Check if version is 18+
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [[ "$NODE_MAJOR" -ge 18 ]]; then
        success "Node.js version is compatible (18+)"
    else
        error "Node.js version is too old. Required: 18+, Found: v$NODE_VERSION"
        ISSUES=$((ISSUES + 1))
    fi
else
    error "Node.js not found. Install Node.js 18+ from https://nodejs.org/"
    ISSUES=$((ISSUES + 1))
fi
echo ""

# ── Check npm ────────────────────────────────────────────────────────────────
echo -e "${bold}[3] Checking npm installation...${reset}"
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version 2>&1)
    success "npm found: v$NPM_VERSION"
else
    error "npm not found. Install npm from https://nodejs.org/"
    ISSUES=$((ISSUES + 1))
fi
echo ""

# ── Check backend .env ───────────────────────────────────────────────────────
echo -e "${bold}[4] Checking backend configuration...${reset}"
if [[ -f "$BACKEND_DIR/.env" ]]; then
    success "backend/.env file exists"

    # Check for required environment variables
    if grep -q "MONGO_URL=" "$BACKEND_DIR/.env"; then
        MONGO_URL=$(grep "MONGO_URL=" "$BACKEND_DIR/.env" | cut -d'=' -f2)
        if [[ "$MONGO_URL" == "mongodb://localhost:27017" ]] || [[ "$MONGO_URL" =~ mongodb\+srv:// ]]; then
            success "MONGO_URL is configured"
        else
            warn "MONGO_URL may need to be updated in backend/.env"
        fi
    else
        error "MONGO_URL not found in backend/.env"
        ISSUES=$((ISSUES + 1))
    fi

    if grep -q "OPENAI_API_KEY=" "$BACKEND_DIR/.env"; then
        OPENAI_KEY=$(grep "OPENAI_API_KEY=" "$BACKEND_DIR/.env" | cut -d'=' -f2)
        if [[ "$OPENAI_KEY" != "your_openai_api_key_here" ]] && [[ -n "$OPENAI_KEY" ]]; then
            success "OPENAI_API_KEY is configured"
        else
            warn "OPENAI_API_KEY needs to be set in backend/.env (required for AI generation)"
            warn "Get one at https://platform.openai.com/api-keys"
        fi
    else
        warn "OPENAI_API_KEY not found in backend/.env"
    fi
else
    error "backend/.env file not found"
    info "Run: cp backend/.env.example backend/.env"
    ISSUES=$((ISSUES + 1))
fi
echo ""

# ── Check frontend .env ──────────────────────────────────────────────────────
echo -e "${bold}[5] Checking frontend configuration...${reset}"
if [[ -f "$FRONTEND_DIR/.env" ]]; then
    success "frontend/.env file exists"

    if grep -q "EXPO_PUBLIC_BACKEND_URL=" "$FRONTEND_DIR/.env"; then
        BACKEND_URL=$(grep "^EXPO_PUBLIC_BACKEND_URL=" "$FRONTEND_DIR/.env" | cut -d'=' -f2)
        if [[ "$BACKEND_URL" == "http://localhost:8001" ]]; then
            success "EXPO_PUBLIC_BACKEND_URL is configured for local development"
        else
            info "EXPO_PUBLIC_BACKEND_URL: $BACKEND_URL"
        fi
    else
        error "EXPO_PUBLIC_BACKEND_URL not found in frontend/.env"
        ISSUES=$((ISSUES + 1))
    fi
else
    error "frontend/.env file not found"
    info "Run: cp frontend/.env.example frontend/.env"
    ISSUES=$((ISSUES + 1))
fi
echo ""

# ── Check backend dependencies ───────────────────────────────────────────────
echo -e "${bold}[6] Checking backend dependencies...${reset}"
if [[ -d "$BACKEND_DIR/.venv" ]]; then
    success "Python virtual environment exists"
else
    warn "Python virtual environment not found"
    info "Run: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
fi
echo ""

# ── Check frontend dependencies ──────────────────────────────────────────────
echo -e "${bold}[7] Checking frontend dependencies...${reset}"
if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
    success "Node modules installed"
else
    warn "Node modules not found"
    info "Run: cd frontend && npm install --legacy-peer-deps"
fi
echo ""

# ── Check MongoDB connection ─────────────────────────────────────────────────
echo -e "${bold}[8] Checking MongoDB...${reset}"
if command -v mongod >/dev/null 2>&1; then
    success "MongoDB (mongod) found on system"

    # Try to check if MongoDB is running
    if pgrep -x mongod >/dev/null 2>&1; then
        success "MongoDB appears to be running"
    else
        warn "MongoDB (mongod) may not be running"
        info "Start MongoDB with: mongod"
        info "Or use MongoDB Atlas: https://www.mongodb.com/atlas"
    fi
else
    info "MongoDB (mongod) not found locally"
    info "If using MongoDB Atlas, ensure MONGO_URL is set correctly in backend/.env"
fi
echo ""

# ── Check demo files ─────────────────────────────────────────────────────────
echo -e "${bold}[9] Checking demo files...${reset}"
if [[ -f "$ROOT/demo/captain_blanket_demo.json" ]]; then
    success "Demo project files found"
else
    warn "Demo project files not found in demo/ directory"
fi
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo -e "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
if [[ $ISSUES -eq 0 ]]; then
    echo -e "${green}${bold}✓ Setup verification passed!${reset}"
    echo ""
    echo "You're ready to run Rainstorms!"
    echo ""
    echo "Next steps:"
    echo "  1. Start both servers:    ${bold}bash start.sh${reset}"
    echo "  2. Open in browser:       ${bold}http://localhost:8081${reset}"
    echo "  3. Try the demo project or create your first story!"
else
    echo -e "${yellow}${bold}⚠ Setup verification found $ISSUES issue(s)${reset}"
    echo ""
    echo "Please address the issues above before running Rainstorms."
    echo ""
    echo "Quick fixes:"
    echo "  • Missing .env files:     ${bold}cp backend/.env.example backend/.env${reset}"
    echo "                            ${bold}cp frontend/.env.example frontend/.env${reset}"
    echo "  • Missing dependencies:   ${bold}bash start.sh${reset} (installs everything)"
    echo ""
    echo "For detailed setup instructions, see: ${bold}GETTING_STARTED.md${reset}"
fi
echo -e "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
