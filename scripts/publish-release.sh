#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Rainstorms — publish v0.1.0 release (run this AFTER merging the PR to main)
#
# Prerequisites:
#   • gh CLI installed and authenticated (gh auth login)
#   • Working directory is the repo root on the main branch
#   • git tag v0.1.0 already exists locally (created by the PR branch)
#
# Usage:
#   git checkout main && git pull
#   bash scripts/publish-release.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

OWNER="Bboy9090"
REPO="Rainstorms"
VERSION="v0.1.0"

echo "Publishing $VERSION for $OWNER/$REPO ..."

# ── 1. Tag ────────────────────────────────────────────────────────────────────
if ! git tag --list | grep -q "^${VERSION}$"; then
  git tag -a "$VERSION" -m "Rainstorms $VERSION — initial public release"
fi
git push origin "$VERSION"

# ── 2. GitHub release ─────────────────────────────────────────────────────────
gh release create "$VERSION" \
  --title "Rainstorms $VERSION — initial public release" \
  --notes "## 🌧️ Rainstorms v0.1.0

AI-powered children's picture-book creation tool.

### What's in this release

- Full story generation pipeline: idea → blueprint → characters → pages → export
- Story Memory consistency tracking across all pages
- \"Improve This Page\" modifiers (funnier, cozier, simpler, more emotional, add dialogue)
- PDF and plain-text export
- Optional JWT auth; guest mode for instant access
- Pre-loaded *Captain Blanket* demo project (no API key required to explore)
- React Native/Expo frontend (web, iOS, Android)
- FastAPI + MongoDB backend

### Quick start

\`\`\`bash
git clone https://github.com/Bboy9090/Rainstorms.git
cd Rainstorms
cp backend/.env.example backend/.env  # fill in MONGO_URL + OPENAI_API_KEY
bash start.sh
\`\`\`

See [README](README.md) for full setup instructions."

# ── 3. Repo description + topics ─────────────────────────────────────────────
gh api "repos/$OWNER/$REPO" \
  -X PATCH \
  -f description="AI-powered children's picture-book creation — idea to draft in one session 🌧️"

gh api "repos/$OWNER/$REPO/topics" \
  -X PUT \
  -F "names[]=ai" \
  -F "names[]=children-books" \
  -F "names[]=react-native" \
  -F "names[]=expo" \
  -F "names[]=fastapi" \
  -F "names[]=story-generation" \
  -F "names[]=openai" \
  -F "names[]=mongodb" \
  -F "names[]=picture-book" \
  -F "names[]=creative-writing"

# ── 4. Issue labels ───────────────────────────────────────────────────────────
create_label() {
  gh label create "$1" --color "$2" --description "$3" --force
}

create_label "bug"             "d73a4a" "Something isn't working"
create_label "enhancement"     "a2eeef" "New feature or request"
create_label "documentation"   "0075ca" "Improvements or additions to documentation"
create_label "good first issue" "7057ff" "Good for newcomers"
create_label "help wanted"     "008672" "Extra attention is needed"
create_label "ai / llm"        "e4e669" "Related to AI story generation"
create_label "frontend"        "6366f1" "React Native / Expo frontend"
create_label "backend"         "009688" "FastAPI / Python backend"
create_label "export"          "f97316" "PDF or text export"
create_label "v0.2.0"          "c5def5" "Planned for v0.2.0"

# ── 5. Next milestone ─────────────────────────────────────────────────────────
gh api "repos/$OWNER/$REPO/milestones" \
  -X POST \
  -f title="v0.2.0" \
  -f description="Series support, illustration generation, UX polish" \
  -f due_on="2026-06-01T00:00:00Z"

echo ""
echo "✅  v0.1.0 released!"
echo "✅  Description and topics updated!"
echo "✅  Labels created!"
echo "✅  Milestone v0.2.0 created!"
