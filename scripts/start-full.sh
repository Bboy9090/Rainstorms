#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Rainstorms — One-Click Full Stack (Docker backend + Mongo, Expo frontend)
# Usage:  ./scripts/start-full.sh
# Keys: backend/.env (GROQ_API_KEY, etc.) | frontend/.env (EXPO_PUBLIC_BACKEND_URL)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

bold="\033[1m"
green="\033[0;32m"
yellow="\033[0;33m"
red="\033[0;31m"
reset="\033[0m"
ok()   { echo -e "${green}✓${reset} $*"; }
warn() { echo -e "${yellow}⚠${reset} $*"; }
die()  { echo -e "${red}✗${reset} $*" >&2; exit 1; }

echo -e "\n${bold}Rainstorms — One-Click Full Stack${reset}\n"

# Ensure env files exist
[[ -f "$BACKEND/.env" ]] || { cp "$BACKEND/.env.example" "$BACKEND/.env"; die "Created backend/.env — add GROQ_API_KEY, then re-run."; }
[[ -f "$FRONTEND/.env" ]] || { cp "$FRONTEND/.env.example" "$FRONTEND/.env"; ok "Created frontend/.env"; }

# Try Docker first; fall back to start.sh (Python + local MongoDB)
USE_DOCKER=false
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  USE_DOCKER=true
fi

if $USE_DOCKER; then
  cd "$ROOT"
  export $(grep -v '^#' "$BACKEND/.env" | xargs) 2>/dev/null || true
  docker compose up -d --build 2>&1 | tail -5
  ok "Backend + MongoDB (Docker) starting"
  for i in {1..20}; do
    sleep 2
    curl -sf http://localhost:8001/api/health >/dev/null 2>&1 && break
    [[ $i -eq 20 ]] && die "Backend never came up. Check: docker compose logs backend"
  done
else
  warn "Docker not running — using start.sh (Python + local MongoDB)"
  warn "Ensure MongoDB is running: brew services start mongodb-community"
  exec "$ROOT/start.sh"
fi

ok "Backend ready → http://localhost:8001"

# Install frontend deps if needed
cd "$FRONTEND"
[[ -d node_modules ]] || npm install --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
ok "Frontend deps OK"

# Start frontend (foreground)
echo ""
echo -e "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
echo -e "${green}  Rainstorms is running!${reset}"
echo -e "  Frontend  →  ${green}http://localhost:8081${reset}"
echo -e "  Backend   →  ${green}http://localhost:8001${reset}"
echo -e "  API docs  →  ${green}http://localhost:8001/docs${reset}"
echo -e "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
echo -e "\nPress Ctrl+C to stop.\n"

exec npx expo start --web --port 8081
