# Rainstorms — Replit Setup

AI-powered children's picture book creator. Full-stack monorepo with a Python FastAPI backend and a React Native/Expo web frontend.

## Architecture

- **Backend**: FastAPI (Python 3.12) — `backend/server.py`, runs on port 8000
- **Frontend**: Expo (React Native for Web) — `frontend/`, runs on port 5000
- **Database**: MongoDB Atlas (via `motor` async driver)
- **AI**: Supports Groq, OpenAI, and Google Gemini via `litellm`

## Workflows

| Workflow | Command | Port | Type |
|---|---|---|---|
| `Backend API` | `cd backend && uvicorn server:app --host 0.0.0.0 --port 8000 --reload` | 8000 | console |
| `Start application` | `cd frontend && npx expo start --web --port 5000 --host 0.0.0.0` | 5000 | webview |

## Required Secrets

Set these in the Replit Secrets tab:

| Secret | Description |
|---|---|
| `MONGO_URL` | MongoDB Atlas connection string (SRV format) |
| `GROQ_API_KEY` | Groq API key for AI generation (primary) |
| `OPENAI_API_KEY` | OpenAI API key (optional, for DALL-E image generation) |

## Environment Variables

| Variable | Value | Description |
|---|---|---|
| `LLM_PROVIDER` | `groq` | AI provider (groq / openai / gemini) |
| `DB_NAME` | `rainstorms_db` | MongoDB database name |
| `JWT_SECRET` | (auto-generated) | JWT signing secret |
| `EXPO_PUBLIC_BACKEND_URL` | Replit backend URL on port 8000 | Frontend → Backend URL |

## Frontend → Backend Connection

The frontend reads `EXPO_PUBLIC_BACKEND_URL` from `app.config.js` → `Constants.expoConfig.extra`. This is set to the Replit dev domain on port 8000.

## Key Files

- `backend/server.py` — Main FastAPI app (5000+ lines, all routes)
- `backend/ai_helper.py` — LLM abstraction layer (litellm)
- `backend/lore_engine.py` — LoreEngine universe management
- `frontend/src/utils/api.ts` — Axios client, reads `EXPO_PUBLIC_BACKEND_URL`
- `frontend/app/_layout.tsx` — Root layout, providers
- `frontend/app.config.js` — Expo config, injects backend URL

## Package Management

- Backend: `pip install -r backend/requirements.txt --no-deps` (pinned versions have conflicts; install without strict resolution)
- Frontend: `npm install --legacy-peer-deps --ignore-scripts` (husky requires `--ignore-scripts` in Replit)

## Notes

- Vercel Analytics removed from `_layout.tsx` (not compatible with Replit)
- CORS is configured via `CORS_ORIGINS` env var, defaults to `*`
- Static files (illustrations, covers, characters) are served from `backend/static/`
