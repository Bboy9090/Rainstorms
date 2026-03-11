#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Rainstorms — Legendary Deploy
# One command: validate, build, push. Wraps deploy-ultimate.sh with pre-flight.
# Expo + Docker + Railway + Vercel. Keys in place, API in place, flawless.
#
# Usage:  ./scripts/deploy-legendary.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bold="\033[1m"
green="\033[0;32m"
reset="\033[0m"

echo ""
echo -e "${bold}╔══════════════════════════════════════════════════════════════╗${reset}"
echo -e "${bold}║  Rainstorms v1.1 — Legendary Deploy                           ║${reset}"
echo -e "${bold}║  Expo → Vercel  │  FastAPI + Docker → Railway  │  Atlas      ║${reset}"
echo -e "${bold}╚══════════════════════════════════════════════════════════════╝${reset}"
echo ""

# Run ultimate deploy
exec "$ROOT/scripts/deploy-ultimate.sh"
