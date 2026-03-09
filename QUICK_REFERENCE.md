# Quick Start Reference Card

**Rainstorms** — Turn story ideas into complete children's books

---

## 🚀 First Time Setup (5 minutes)

```bash
# 1. Clone the repo
git clone https://github.com/Bboy9090/Rainstorms.git
cd Rainstorms

# 2. Verify setup
bash verify-setup.sh

# 3. Configure environment
# Edit backend/.env and set:
#   - MONGO_URL (MongoDB connection)
#   - OPENAI_API_KEY (AI generation)
nano backend/.env

# 4. Start everything
bash start.sh
```

Then open: **http://localhost:8081**

---

## 📖 Essential Commands

### Start the app
```bash
bash start.sh
```
- Backend: http://localhost:8001
- Frontend: http://localhost:8081
- API Docs: http://localhost:8001/docs

### Verify setup
```bash
bash verify-setup.sh
```

### Start backend only
```bash
cd backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Start frontend only
```bash
cd frontend
npx expo start --web
```

### Run tests
```bash
python backend_test.py
```

---

## 📚 Documentation Quick Links

| Document | Purpose |
|----------|---------|
| **[GETTING_STARTED.md](GETTING_STARTED.md)** | Complete setup guide (step-by-step) |
| **[docs/MVP_WORKFLOW.md](docs/MVP_WORKFLOW.md)** | How to create your first book |
| **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** | Fix common issues |
| **[README.md](README.md)** | Project overview and features |
| **[docs/ROADMAP.md](docs/ROADMAP.md)** | Future features and plans |

---

## 🎯 Your First Book (10 minutes)

### Option A: Try the Demo (No API key needed)
1. Open http://localhost:8081
2. Click **"Try Demo Project"**
3. Explore the pre-loaded Captain Blanket story
4. Click **"Export"** → Download PDF

### Option B: Create a New Book
1. Open http://localhost:8081
2. Click **"Create New Project"**
3. Navigate to **"Idea Lab"**
4. Enter a story idea:
   ```
   A brave puppy learns to swim to save his toy boat
   ```
5. Click **"Generate Story Blueprint"**
6. Review and accept the blueprint
7. Navigate to **"Page Builder"**
8. Click **"Generate All Pages"**
9. Click **"Export"** → Download PDF

---

## 🔧 Configuration Files

### backend/.env (Required)
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=rainstorms_db
JWT_SECRET=your_secret_here
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
GEMINI_API_KEY=your-gemini-key-here  # Optional
```

### frontend/.env (Auto-configured)
```bash
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

---

## 🐛 Common Issues

### Backend won't start
```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend won't start
```bash
cd frontend
rm -rf node_modules
npm install --legacy-peer-deps
```

### MongoDB connection fails
```bash
# Start local MongoDB
mongod

# Or use MongoDB Atlas and update MONGO_URL in backend/.env
```

### API generation fails
```bash
# Check API key in backend/.env
grep OPENAI_API_KEY backend/.env
```

**See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for detailed solutions.**

---

## 📊 Project Structure

```
Rainstorms/
├── backend/              # FastAPI server
│   ├── server.py         # All API endpoints
│   ├── lore_engine.py    # AI story generation
│   └── ai_helper.py      # LLM integration
├── frontend/             # React Native + Expo
│   ├── app/              # Screens (file-based routing)
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── context/      # State management
│       └── utils/        # API client, helpers
├── demo/                 # Captain Blanket demo project
├── docs/                 # All documentation
├── start.sh              # One-command startup
└── verify-setup.sh       # Setup verification
```

---

## 🌟 Key Features

| Feature | What it does |
|---------|--------------|
| **Idea Lab** | Turn a sentence into a full story outline |
| **Story Blueprint** | AI-generated title, hook, summary, themes |
| **Character Forge** | Auto-create characters with personalities |
| **Page Builder** | Generate story text and illustration prompts |
| **Story Memory** | Keep characters and plot consistent |
| **Export** | Download as PDF, JSON, or plain text |

---

## 💰 API Costs (Estimated)

### OpenAI (GPT-4 + DALL-E 3)
- Story generation: ~$0.20-0.50 per book
- Illustrations: ~$0.04-0.08 per image
- **Total**: ~$1.00-2.00 per complete book

### Google Gemini (Text only)
- Story generation: Free tier available
- Then ~$0.02 per 1000 tokens

---

## 🆘 Getting Help

1. **Run diagnostics**: `bash verify-setup.sh`
2. **Check logs**: Terminal where backend/frontend is running
3. **Read the docs**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
4. **Open an issue**: https://github.com/Bboy9090/Rainstorms/issues

---

## 🎓 Next Steps

Once you have a working app:

1. **Explore the demo** to see what's possible
2. **Create your first book** end-to-end
3. **Experiment** with different tones and age ranges
4. **Deploy to production** using [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
5. **Contribute** by opening PRs or issues

---

**Ready to build? Run `bash start.sh` and open http://localhost:8081** 🚀
