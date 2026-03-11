#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Rainstorms — Failsafe Production Deployment
# Deploys backend (Railway) and frontend (Vercel) with validation at each step.
# Usage: ./scripts/deploy.sh [--cli]
#   Default: git push → triggers Railway + Vercel via GitHub
#   --cli:   use Railway + Vercel CLI (requires railway + vercel installed & linked)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BACKEND_URL="${BACKEND_URL:-https://backend-production-4938.up.railway.app}"

# Colors
red="\033[0;31m"
green="\033[0;32m"
yellow="\033[0;33m"
bold="\033[1m"
reset="\033[0m"
ok()  { echo -e "${green}✓${reset} $*"; }
warn() { echo -e "${yellow}⚠${reset} $*"; }
err()  { echo -e "${red}✗${reset} $*" >&2; }
die()  { err "$*"; exit 1; }

# ── Parse flags ─────────────────────────────────────────────────────────────
USE_CLI=false
[[ "${1:-}" == "--cli" ]] && USE_CLI=true

# ── 0. Railway env reminder ──────────────────────────────────────────────────
echo -e "\n${bold}Railway Variables (Production)${reset}"
echo "  Railway → Backend Service → Variables tab:"
echo "  • MONGO_URL     = mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/?appName=Cluster0"
echo "  • LLM_PROVIDER  = groq"
echo "  • GROQ_API_KEY  = your key from https://console.groq.com"
echo "  • JWT_SECRET    = random string (python3 -c \"import secrets; print(secrets.token_hex(32))\")"
echo "  Atlas → Network Access: add 0.0.0.0/0"
echo ""

# ── 1. Pre-flight checks ─────────────────────────────────────────────────────
echo -e "${bold}1. Pre-flight${reset}"
command -v git >/dev/null 2>&1 || die "git required"
command -v node >/dev/null 2>&1 || die "node required"
command -v npm >/dev/null 2>&1 || die "npm required"
ok "git, node, npm"

# Python (prefer Homebrew for Atlas TLS)
PYTHON=""
for p in /opt/homebrew/opt/python@3.12/bin/python3.12 /opt/homebrew/opt/python@3.11/bin/python3.11 python3.12 python3.11 python3; do
  if [[ "$p" == /* ]]; then [[ -x "$p" ]] && PYTHON="$p" && break
  else command -v "$p" >/dev/null 2>&1 && PYTHON="$p" && break; fi
done
[[ -n "$PYTHON" ]] || die "python3 required"
ok "python: $PYTHON"

# ── 2. Validate backend ─────────────────────────────────────────────────────
echo -e "\n${bold}2. Validate backend${reset}"
cd "$BACKEND"
if [[ -d ".venv" ]]; then
  source .venv/bin/activate
else
  "$PYTHON" -m venv .venv && source .venv/bin/activate
  pip install -q -r requirements.txt
fi
python -c "
import server
# Quick sanity check
assert hasattr(server, 'app'), 'app missing'
" || die "backend validation failed"
ok "backend imports OK"

# ── 3. Validate frontend build ───────────────────────────────────────────────
echo -e "\n${bold}3. Validate frontend build${reset}"
cd "$FRONTEND"
npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
EXPO_PUBLIC_BACKEND_URL="$BACKEND_URL" npx expo export --platform web >/dev/null 2>&1 || die "frontend build failed"
[[ -d dist ]] || die "frontend dist missing"
ok "frontend build OK"

# ── 4. Deploy ───────────────────────────────────────────────────────────────
echo -e "\n${bold}4. Deploy${reset}"

if $USE_CLI; then
  # CLI-based deploy
  command -v railway >/dev/null 2>&1 || die "railway CLI required (brew install railway)"
  command -v vercel >/dev/null 2>&1 || die "vercel CLI required (npm i -g vercel)"

  # Backend
  cd "$BACKEND"
  railway whoami >/dev/null 2>&1 || die "railway not logged in — run: railway login"
  ok "railway logged in"
  railway up --detach 2>/dev/null || railway up
  ok "backend deployed (Railway)"

  # Frontend
  cd "$FRONTEND"
  vercel --prod --yes 2>/dev/null || vercel --prod
  ok "frontend deployed (Vercel)"
else
  # Git push → GitHub triggers Railway + Vercel
  cd "$ROOT"
  if [[ -n "$(git status --porcelain)" ]]; then
    warn "uncommitted changes — committing for deploy"
    git add -A
    git commit -m "chore: deploy $(date +%Y-%m-%d-%H%M)" || true
  fi
  BRANCH=$(git branch --show-current)
  git push origin "$BRANCH" 2>/dev/null || die "git push failed — ensure remote is configured"
  ok "pushed to GitHub ($BRANCH) — Railway & Vercel will auto-deploy"
fi

# ── 5. Health check (with retries) ───────────────────────────────────────────
echo -e "\n${bold}5. Health check${reset}"
for i in {1..12}; do
  sleep 5
  health=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health" 2>/dev/null || echo "000")
  if [[ "$health" == "200" ]]; then
    ok "backend healthy ($BACKEND_URL/api/health)"
    ready=$(curl -s "$BACKEND_URL/api/ready" 2>/dev/null | grep -o '"mongo":"[^"]*"' || true)
    if [[ "$ready" == *"connected"* ]]; then
      ok "MongoDB connected"
    else
      warn "MongoDB: check Railway MONGO_URL & Atlas Network Access (0.0.0.0/0)"
    fi
    break
  fi
  warn "waiting... ($i/12)"
  [[ $i -eq 12 ]] && err "backend not responding after 60s — check Railway dashboard"
done

echo -e "\n${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
echo -e "${green}Deployment complete.${reset}"
echo -e "  Frontend  → https://rainstorms.vercel.app"
echo -e "  Backend   → $BACKEND_URL"
echo -e "  API docs  → $BACKEND_URL/docs"
echo -e "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n"
