# Rainstorms Enterprise Changelog

All notable changes to the Rainstorms monorepo will be documented in this file.

## [1.1.0] - 2026-03-22
### Added
- **Enterprise Task Orchestrator**: Root `Makefile` for unified local dev and deployment.
- **Monorepo Workspaces**: Integrated NPM Workspaces to manage `frontend` and `backend` globally.
- **Automated Guardrails**: `Husky` and `Lint-Staged` added to enforce code formatting (`Black`, `Prettier`, `Flake8`) via Git hooks.
- **Continuous Integration (CI)**: GitHub Actions pipeline for automated backend testing and frontend build validation on all Pull Requests and pushes to `main`.
- **Centralized Configuration**: `backend/config.py` using Pydantic Settings for type-safe environment variable management.
- **Advanced Monitoring**: `/api/ready` endpoint with database and AI provider connection verification.
- **Standardized Response Model**: Global exception handlers providing consistent JSON error formats for the frontend.
- **Observability**: Latency-tracking middleware added to all API requests.
- **Enterprise Documentation**: Added `ARCHITECTURE.md`, `CONTRIBUTING.md`, and `.editorconfig`.

### Changed
- Refactored `backend/server.py` and `backend/ai_helper.py` to use centralized settings instead of disparate `os.environ` calls.
- Updated `backend/requirements.txt` with `pydantic-settings`.
- Optimized backend startup logic to handle missing directories gracefully.

### Fixed
- Backend health check failures resolved by adding an absolute root (`/`) endpoint for Railway's default monitor.
- Image generation fallback: Implemented `pollinations.ai` as a free-tier fallback when OpenAI quotas are exceeded or keys are missing.
- Railway deployment: Corrected `railway.toml` and `Dockerfile` to use the Docker builder instead of Nixpacks.
