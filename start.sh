#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Rainstorms — one-click local dev startup
# Usage:  bash start.sh
# Requires: Python 3.10+, Node 18+, MongoDB (local or Atlas URL in .env)
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

# ── Colour helpers ──────────────────────────────────────────────────────────
bold="\033[1m"; green="\033[0;32m"; yellow="\033[0;33m"; red="\033[0;31m"; reset="\033[0m"
info()  { echo -e "${green}[rainstorms]${reset} $*"; }
warn()  { echo -e "${yellow}[rainstorms]${reset} $*"; }
die()   { echo -e "${red}[rainstorms] ERROR:${reset} $*" >&2; exit 1; }

# ── Pre-flight checks ───────────────────────────────────────────────────────
# Prefer Homebrew Python (links to OpenSSL) for Atlas TLS; then 3.12/3.11
# (3.14 has grpcio/protobuf conflicts; system python.org uses LibreSSL → TLS fails)
PYTHON=""
for p in /opt/homebrew/opt/python@3.12/bin/python3.12 \
         /opt/homebrew/opt/python@3.12/libexec/bin/python3.12 \
         /opt/homebrew/opt/python@3.11/bin/python3.11 \
         /opt/homebrew/opt/python@3.11/libexec/bin/python3.11 \
         /usr/local/opt/python@3.12/bin/python3.12 \
         /usr/local/opt/python@3.11/bin/python3.11 \
         python3.12 python3.11 python3; do
  if [[ "$p" == /* ]]; then
    [[ -x "$p" ]] && PYTHON="$p" && break
  else
    command -v "$p" >/dev/null 2>&1 && PYTHON="$p" && break
  fi
done
[[ -z "$PYTHON" ]] && die "python3 not found. Install Python 3.11 or 3.12 (brew install python@3.12)."
command -v node    >/dev/null 2>&1 || die "node not found. Install Node 18+."
command -v npm     >/dev/null 2>&1 || die "npm not found."

# ── Backend .env ─────────────────────────────────────────────────────────────
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  warn "backend/.env not found — copying from backend/.env.example"
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  warn "Edit backend/.env and set MONGO_URL and OPENAI_API_KEY (and optionally GEMINI_API_KEY), then re-run."
  exit 1
fi

# ── Frontend .env ─────────────────────────────────────────────────────────────
if [[ ! -f "$FRONTEND_DIR/.env" ]]; then
  info "frontend/.env not found — creating from example (defaults to localhost:8001)"
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
fi

# ── Install backend deps ─────────────────────────────────────────────────────
info "Installing Python dependencies…"
cd "$BACKEND_DIR"
if [[ ! -d ".venv" ]]; then
  "$PYTHON" -m venv .venv
fi
source .venv/bin/activate
pip install --quiet -r requirements.txt

# ── Install frontend deps ─────────────────────────────────────────────────────
info "Installing Node dependencies…"
cd "$FRONTEND_DIR"
if [[ ! -d "node_modules" ]]; then
  npm install --legacy-peer-deps
fi

# ── Launch backend ────────────────────────────────────────────────────────────
info "Starting backend on http://localhost:8001 …"
cd "$BACKEND_DIR"
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!

# ── Launch frontend ───────────────────────────────────────────────────────────
info "Starting frontend (web) on http://localhost:8081 …"
cd "$FRONTEND_DIR"
npx expo start --web --port 8081 &
FRONTEND_PID=$!

echo ""
echo -e "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
echo -e "${bold}  Rainstorms is running!${reset}"
echo -e "  Frontend  →  ${green}http://localhost:8081${reset}"
echo -e "  Backend   →  ${green}http://localhost:8001/api/health${reset}"
echo -e "  API docs  →  ${green}http://localhost:8001/docs${reset}"
echo -e "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
echo ""
echo "Press Ctrl+C to stop both servers."

# ── Graceful shutdown ──────────────────────────────────────────────────────
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; info 'Stopped.'" EXIT INT TERM
wait
