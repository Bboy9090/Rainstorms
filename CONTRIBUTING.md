# Contributing to Rainstorms Enterprise

Thank you for contributing to the Rainstorms ecosystem. To maintain world-class engineering standards, please follow these guidelines.

## Development Workflow

1.  **Orchestration**: Always use the root `Makefile` for local tasks. Do not run individual scripts (e.g., `server.py`) directly if a `make` command exists.
2.  **Environment**: All configuration must be driven by `backend/config.py`. Use a local `.env` file for secrets.
3.  **Hooks**: The repo uses `Husky` pre-commit hooks. Your code will be automatically formatted via `Black` and `Prettier` upon commit. Do not bypass these hooks (`--no-verify`) without a critical architectural reason.

## Code Standards

### Python (Backend)
- Use **Type Hints** for all function signatures.
- Follow **asynchronous (async/await)** patterns for all I/O bound operations (DB, AI calls, file system).
- Implement new logic within the `api_router` using standard Pydantic models for request/response bodies.

### React / Expo (Frontend)
- Use functional components with hooks.
- Centralize all API interactions in `src/utils/api.ts`.
- Maintain state within context providers (e.g., `AuthContext`, `ProjectContext`).

## Pull Request Process

1.  **Unit Tests**: Ensure all existing tests pass with `make test`.
2.  **Versioning**: If non-breaking changes are added, increment the `APP_VERSION` in `backend/config.py`.
3.  **CI Validation**: Every PR must pass the GitHub Actions CI Pipeline before it can be merged into `main`.

## Security

- Never commit `.env` files or hardcoded API keys.
- Ensure all sensitive endpoints are protected via the `Authorisation` header logic handled by the `api_router`.
- Use the `/api/ready` endpoint to verify system health post-deployment.
