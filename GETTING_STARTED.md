# Getting Started with Rainstorms

## Overview

This guide will help you turn the Rainstorms repository into a **running app** that you can actually open and use. Follow these steps to go from a codebase to a functioning children's book generator.

---

## Prerequisites

Before you begin, ensure you have:

- **Python 3.10+** and **pip** installed
- **Node 18+** and **npm** installed
- **MongoDB** running (local instance via `mongod` or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)
- **OpenAI API key** for AI text and image generation (get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys))
  - Alternatively, you can use a **Google Gemini API key** for text generation (get one at [aistudio.google.com](https://aistudio.google.com/app/apikey))

---

## Step 1 — Make Sure Backend Runs

The Rainstorms backend is built with:
- **FastAPI** (Python web framework)
- **MongoDB** (database for projects, characters, pages)
- **OpenAI GPT-4** or **Google Gemini** (LLM for story generation)
- **DALL-E 3** (optional, for illustration generation)

### 1.1 Set up the backend environment

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 1.2 Configure environment variables

The `.env` file has already been created from `.env.example`. Now you need to configure it:

```bash
# Edit backend/.env and set your values:
nano .env  # or use your preferred editor
```

**Required settings:**

```bash
# MongoDB connection (required)
MONGO_URL=mongodb://localhost:27017
# Or use MongoDB Atlas:
# MONGO_URL=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net

# Database name
DB_NAME=rainstorms_db

# JWT secret (change in production!)
JWT_SECRET=your_long_random_secret_here

# AI Provider (choose "openai" or "gemini")
LLM_PROVIDER=openai

# OpenAI API key (required for images and OpenAI text generation)
OPENAI_API_KEY=sk-your-actual-openai-key-here

# Gemini API key (required only if using LLM_PROVIDER=gemini)
GEMINI_API_KEY=your-gemini-key-here
```

### 1.3 Start the backend

```bash
cd backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

If everything is wired correctly, you should see:

```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 1.4 Verify the backend is running

Open your browser and navigate to:

- **API Health Check**: [http://localhost:8001/api/health](http://localhost:8001/api/health)
- **API Documentation (Swagger)**: [http://localhost:8001/docs](http://localhost:8001/docs)

If you see the Swagger/FastAPI interactive docs, **your backend works**! ✅

---

## Step 2 — Run the Frontend

The Rainstorms frontend is built with:
- **React Native** + **Expo** (cross-platform mobile/web framework)
- **Expo Router** (file-based navigation)
- **TypeScript**

### 2.1 Set up the frontend environment

```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps
```

### 2.2 Configure environment variables

The `.env` file has already been created from `.env.example`. Verify it points to your backend:

```bash
# frontend/.env should contain:
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

For local development, this default value is correct. No changes needed.

### 2.3 Start the frontend

```bash
cd frontend
npm run web
# or: npx expo start --web
```

The Expo dev server will start and automatically open your browser to:

**http://localhost:8081**

You should see the **Rainstorms home screen** with options to:
- Create a new project
- Try the demo project (Captain Blanket)
- Sign in

If you see this interface, **your frontend works**! ✅

---

## Step 3 — Connect Frontend → Backend

The frontend is already configured to connect to the backend via the `EXPO_PUBLIC_BACKEND_URL` environment variable.

### Test the connection

1. Open [http://localhost:8081](http://localhost:8081) in your browser
2. Click **"Try Demo Project"**
3. You should see the pre-loaded **Captain Blanket and the Midnight Brother** story
4. This confirms the frontend is successfully communicating with the backend API

### Key API Endpoints

The frontend uses these main endpoints (visible in Swagger at [http://localhost:8001/docs](http://localhost:8001/docs)):

- `POST /api/projects` — Create a new story project
- `POST /api/projects/{id}/generate-blueprint` — Generate story outline
- `POST /api/projects/{id}/generate-pages` — Generate page text
- `POST /api/projects/{id}/pages/{page_id}/illustrations/generate` — Generate illustration prompts
- `GET /api/projects/{id}/export/{format}` — Export as PDF/JSON/text
- `GET /api/demo-project` — Load the Captain Blanket demo

All API interactions are managed by `frontend/src/utils/api.ts`.

---

## Step 4 — First MVP Workflow

Once both servers are running, try the full MVP workflow:

### Option A: Try the Demo (No API Key Required)

1. Open [http://localhost:8081](http://localhost:8081)
2. Click **"Try Demo Project"**
3. Explore the pre-generated **Story Blueprint**
4. View the **Characters** (Oliver and Baby Max)
5. Navigate to **Page Builder** to see all 10 pages with text and illustration prompts
6. Click **"Export"** → **Download PDF**

This workflow proves the full pipeline works without making any AI API calls.

### Option B: Create Your First Book (Requires API Key)

1. Open [http://localhost:8081](http://localhost:8081)
2. Click **"Create New Project"**
3. Navigate to **"Idea Lab"**
4. Enter a story idea:
   ```
   Captain Blanket protects his baby brother from night monsters
   ```
5. Click **"Generate Story Blueprint"**
6. Wait for the AI to generate:
   - Title
   - Hook (one-line summary)
   - Story summary
   - Theme
   - Page-by-page outline
7. Click **"Accept Blueprint"** → navigate to **Characters**
8. Review auto-generated characters with personalities and appearances
9. Navigate to **"Page Builder"**
10. Click **"Generate All Pages"** or generate pages one by one
11. Each page generates:
    - Story text
    - Illustration prompt
12. (Optional) Click **"Generate Illustration"** to create images via DALL-E 3
13. Click **"Export"** → **"Download Story PDF"**

If you complete this flow, **your MVP exists**! 🎉

---

## Step 5 — The One-Command Startup

Instead of running Step 1-3 manually, use the included startup script:

```bash
# From the repository root
bash start.sh
```

This script will:
1. Check that Python and Node are installed
2. Create `.env` files from `.env.example` (if they don't exist)
3. Install Python dependencies in `backend/.venv`
4. Install Node dependencies in `frontend/node_modules`
5. Start the backend on **http://localhost:8001**
6. Start the frontend on **http://localhost:8081**

Then open **http://localhost:8081** in your browser.

> **Note**: On first run, the script will exit if `.env` files don't have real values. Edit `backend/.env` to add your `MONGO_URL` and `OPENAI_API_KEY`, then re-run `bash start.sh`.

---

## Step 6 — The Moment You Know It Works

When you can:

1. Type a story idea:
   ```
   Captain Blanket protects his baby brother from night monsters
   ```

2. And the app produces:
   - 20–30 pages of story text
   - Illustration prompts for each page
   - Character profiles with personalities
   - A structured page layout
   - A downloadable PDF

**Then Rainstorms becomes real.** 🌧️

You now have a functioning AI children's book generator that goes from:

**Idea → Story Blueprint → Characters → Pages → Illustrations → PDF**

---

## Troubleshooting

> **📖 For comprehensive troubleshooting**, see **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** for detailed solutions to common issues.

Quick fixes for the most common problems:

### Backend won't start

**Error: `ModuleNotFoundError: No module named 'fastapi'`**
- Solution: Activate the venv and reinstall dependencies
  ```bash
  cd backend
  source .venv/bin/activate
  pip install -r requirements.txt
  ```

**Error: `pymongo.errors.ServerSelectionTimeoutError`**
- Solution: MongoDB is not running or `MONGO_URL` is incorrect
  - For local MongoDB: Start `mongod` in a separate terminal
  - For MongoDB Atlas: Check your connection string includes username/password and allows your IP

**Error: Backend starts but API calls fail**
- Solution: Check that `OPENAI_API_KEY` is set correctly in `backend/.env`
- Test the health endpoint: [http://localhost:8001/api/health](http://localhost:8001/api/health)

### Frontend won't start

**Error: `npm ERR! Could not resolve dependency`**
- Solution: Use `--legacy-peer-deps` flag
  ```bash
  npm install --legacy-peer-deps
  ```

**Error: `EXPO_PUBLIC_BACKEND_URL is not defined`**
- Solution: Check that `frontend/.env` exists and contains:
  ```bash
  EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
  ```

### Frontend can't reach backend

**Error: Network request failed / `CORS` error**
- Solution: Ensure backend is running on port 8001
- Check that `EXPO_PUBLIC_BACKEND_URL` matches the backend port
- Backend already has CORS enabled for all origins (see `server.py:5219`)

**Error: 401 Unauthorized**
- Solution: You may need to create an account or use the demo project
- The demo project works without authentication

---

## What's Next?

Now that you have a running app, you can:

1. **Explore the codebase**:
   - `backend/server.py` — All API endpoints
   - `backend/lore_engine.py` — AI story generation logic
   - `frontend/app/` — All screens (Expo Router file-based routing)
   - `frontend/src/context/ProjectContext.tsx` — State management

2. **Customize the AI prompts**:
   - Edit `backend/lore_engine.py` to modify story generation behavior
   - Adjust tone, length, complexity, etc.

3. **Add new features**:
   - See `docs/ROADMAP.md` for planned features
   - Series/sequel support
   - Voice narration export
   - Real-time collaboration

4. **Deploy to production**:
   - See `docs/DEPLOYMENT.md` for Railway + Vercel setup
   - Configure environment variables for production
   - Set up MongoDB Atlas
   - Enable rate limiting and API key management

---

## Demo Content

The repository includes a complete demo story in the `demo/` folder:

```
demo/
├── captain_blanket_demo.json    # Full structured export
├── captain_blanket_outline.md   # Story outline and characters
└── captain_blanket_pages.md     # All 10 pages with prompts
```

This demonstrates what Rainstorms can generate. When someone opens the repo, they immediately see: **"Oh. This thing actually generates books."**

---

## Running Tests

Verify everything works by running the full API test suite:

```bash
# Make sure the backend is running on localhost:8001
cd /path/to/Rainstorms
python backend_test.py
```

All 22 tests should pass, covering:
- Health check
- User authentication
- Demo project loading
- Project CRUD operations
- Blueprint generation
- Character creation
- Page generation
- Story memory consistency
- Export formats (PDF, JSON, text)

---

## Support

- **Documentation**: Check the `docs/` folder for detailed guides
- **Issues**: Report bugs at [github.com/Bboy9090/Rainstorms/issues](https://github.com/Bboy9090/Rainstorms/issues)
- **API Reference**: View interactive docs at [http://localhost:8001/docs](http://localhost:8001/docs) when running locally

---

**You're ready to build!** 🚀

The hard part is done. You have a running app. Now iterate and make it better.
