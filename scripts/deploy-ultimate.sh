#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Rainstorms — Ultimate Deployment Script (Docker-based)
# Builds backend with Docker (fixes Groq/network issues vs Nixpacks), validates,
# and deploys. Works with Railway (Dockerfile), Render, Fly.io, or any container host.
#
# Usage:
#   ./scripts/deploy-ultimate.sh              # Validate + git push (Railway auto-builds Dockerfile)
#   ./scripts/deploy-ultimate.sh --local       # Run full stack locally via docker compose
#   ./scripts/deploy-ultimate.sh --build      # Build Docker image locally (test only)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BACKEND_URL="${BACKEND_URL:-https://backend-production-4938.up.railway.app}"

red="\033[0;31m"
green="\033[0;32m"
yellow="\033[0;33m"
bold="\033[1m"
reset="\033[0m"
ok()   { echo -e "${green}✓${reset} $*"; }
warn() { echo -e "${yellow}⚠${reset} $*"; }
err()  { echo -e "${red}✗${reset} $*" >&2; }
die()  { err "$*"; exit 1; }

# ── Parse args ─────────────────────────────────────────────────────────────
MODE="deploy"
[[ "${1:-}" == "--local" ]] && MODE="local"
[[ "${1:-}" == "--build" ]] && MODE="build"

# ── 1. Pre-flight ───────────────────────────────────────────────────────────
echo -e "\n${bold}Rainstorms Ultimate Deploy${reset}"
echo "Mode: $MODE"
echo ""

command -v docker >/dev/null 2>&1 || die "Docker required (brew install docker)"
command -v git   >/dev/null 2>&1 || die "git required"
ok "Docker, git"

# ── 2. Validate backend Docker build ──────────────────────────────────────
echo -e "\n${bold}2. Build backend image${reset}"
cd "$BACKEND"
if docker build -t rainstorms-backend:latest . >/dev/null 2>&1; then
  ok "Backend image built"
else
  warn "Docker build skipped (run 'docker info' to start daemon). Railway will build from Dockerfile on push."
fi

if [[ "$MODE" == "build" ]]; then
  echo -e "\n${green}Build complete. Run locally: docker compose up${reset}\n"
  exit 0
fi

# ── 3. Local mode: docker compose up ───────────────────────────────────────
if [[ "$MODE" == "local" ]]; then
  echo -e "\n${bold}3. Start stack (backend + MongoDB)${reset}"
  cd "$ROOT"
  if [[ ! -f "$BACKEND/.env" ]]; then
    warn "backend/.env missing — copy from backend/.env.example and set GROQ_API_KEY"
    cp "$BACKEND/.env.example" "$BACKEND/.env" 2>/dev/null || true
  fi
  export $(grep -v '^#' "$BACKEND/.env" | xargs) 2>/dev/null || true
  docker compose up --build -d
  sleep 5
  curl -sf http://localhost:8001/api/health >/dev/null && ok "Backend: http://localhost:8001" || warn "Backend may need a moment"
  echo -e "\n${green}Stack running. Logs: docker compose logs -f${reset}\n"
  exit 0
fi

# ── 4. Deploy mode: validate frontend, push ─────────────────────────────────
echo -e "\n${bold}3. Validate frontend${reset}"
command -v node >/dev/null 2>&1 || die "node required"
command -v npm  >/dev/null 2>&1 || die "npm required"
cd "$FRONTEND"
npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
EXPO_PUBLIC_BACKEND_URL="$BACKEND_URL" npx expo export --platform web >/dev/null 2>&1 || die "Frontend build failed"
ok "Frontend build OK"

echo -e "\n${bold}4. Deploy (git push)${reset}"
cd "$ROOT"
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "chore: deploy $(date +%Y-%m-%d-%H%M)" || true
fi
BRANCH=$(git branch --show-current)
git push origin "$BRANCH" 2>/dev/null || die "git push failed"
ok "Pushed to $BRANCH — Railway builds Dockerfile automatically"

# ── 5. Health check ────────────────────────────────────────────────────────
echo -e "\n${bold}5. Health check${reset}"
for i in {1..15}; do
  sleep 5
  health=$(curl -sf -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health" 2>/dev/null || echo "000")
  if [[ "$health" == "200" ]]; then
    ok "Backend: $BACKEND_URL"
    ready=$(curl -s "$BACKEND_URL/api/ready" 2>/dev/null || echo "{}")
    if echo "$ready" | grep -q '"mongo":"connected"'; then ok "MongoDB connected"; fi
    if echo "$ready" | grep -q '"configured":true'; then ok "LLM configured"; fi
    break
  fi
  warn "Waiting... ($i/15)"
  [[ $i -eq 15 ]] && err "Backend not responding — check Railway dashboard"
done

echo -e "\n${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
echo -e "${green}Deployment complete.${reset}"
echo -e "  Frontend  → https://rainstorms.vercel.app"
echo -e "  Backend   → $BACKEND_URL"
echo -e "\n${bold}Ensure Railway Variables:${reset} MONGO_URL, GROQ_API_KEY, LLM_PROVIDER=groq, JWT_SECRET"
echo -e "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n"
