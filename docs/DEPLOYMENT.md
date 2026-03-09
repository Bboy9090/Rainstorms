# Rainstorms — Deployment Guide

> **TL;DR:** Launch Rainstorms as a **web-first SaaS** on day one (browser, no app-store wait).  
> Add iOS and Android as a second step once the web version is proven.

---

## 1. What Type of App Is This?

Rainstorms is best shipped as a **Progressive Web App (PWA) / SaaS website** because:

| Factor | Web SaaS | Native App |
|--------|----------|------------|
| Time to launch | Same day | 1–4 week App Store review |
| Reach | Any device with a browser | iOS / Android only |
| AI generation UX | Perfect — desktop keyboard & screen | Fine, but less ergonomic |
| Iteration speed | Instant deploys | Store re-review per release |
| Cost to start | ~$0–15/month | Apple ($99/yr) + Google ($25 one-time) |

The codebase already produces a **static web bundle** via Expo (`npx expo export --platform web`).  
The same TypeScript/React Native code can be compiled for iOS and Android later via **Expo EAS Build** — no code rewrite needed.

---

## 2. Production Architecture (Recommended)

```
User's Browser
     │
     ▼
┌─────────────────────────────┐
│  Vercel (or Netlify)        │  ← Static web build (HTML/JS/CSS)
│  frontend/dist/             │    Free tier handles production traffic
└─────────────────────────────┘
     │  HTTPS API calls
     ▼
┌─────────────────────────────┐
│  Railway (or Render)        │  ← FastAPI backend (Python)
│  backend/server.py          │    $5–20/month; persistent disk for
│  /static/…                  │    illustrations & character sheets
└─────────────────────────────┘
     │  async driver
     ▼
┌─────────────────────────────┐
│  MongoDB Atlas M0 (free)    │  ← Database
│  Projects, Users, Lore      │    Upgrade to M10 ($57/mo) at scale
└─────────────────────────────┘
     │  REST
     ▼
┌─────────────────────────────┐
│  Emergent / OpenAI API      │  ← AI generation & image creation
└─────────────────────────────┘
```

**Why these services?**

- **Vercel** — zero-config static hosting, instant global CDN, free SSL, preview URLs on every deploy.
- **Railway** — one-click Python/FastAPI deploy from a GitHub repo, persistent disk volumes (required for `/static/illustrations` and `/static/characters`), autoscale, built-in environment variable management.
- **MongoDB Atlas M0** — free 512 MB cluster, automatic backups, TLS by default.  Upgrade when you need more storage or dedicated IOPS.

> **Alternative:** Render works equally well and also has a free tier. For very high traffic, migrate to a dedicated VPS (DigitalOcean, Hetzner) with Docker Compose.

---

## 3. Pre-Launch Checklist

Work through every item in this list before directing real users to the app.

### 3a — Environment Variables

**Backend (`backend/.env`)**

| Variable | Production value |
|----------|-----------------|
| `MONGO_URL` | MongoDB Atlas SRV string (`mongodb+srv://...`) |
| `DB_NAME` | `rainstorms_prod` (keep separate from dev) |
| `JWT_SECRET` | 64+ random characters — run `python -c "import secrets; print(secrets.token_hex(32))"` |
| `EMERGENT_LLM_KEY` | Your Emergent Integrations production key |
| `OPENAI_API_KEY` | Your OpenAI production key (for DALL·E 3 illustrations) |
| `SAGA_ARCHITECT_BASE_URL` | Leave blank unless you are using SagaArchitect integration |

**Frontend (set in Vercel / Netlify dashboard — do NOT commit)**

| Variable | Production value |
|----------|-----------------|
| `EXPO_PUBLIC_BACKEND_URL` | `https://api.yourdomain.com` (no trailing slash) |

### 3b — Harden CORS

The default CORS policy (`allow_origins=["*"]`) must be restricted in production.  
Open `backend/server.py` and replace the wildcard with your real frontend URL:

```python
# backend/server.py (bottom of file)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://rainstorms.app",           # your custom domain
        "https://www.rainstorms.app",        # www variant
        "https://rainstorms.vercel.app",     # Vercel preview domain
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 3c — Rate Limiting

Add `slowapi` to throttle AI endpoints before they go public so a single user cannot drain your LLM quota:

```bash
pip install slowapi
```

```python
# backend/server.py — add near the top
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Then decorate the generation endpoints:

```python
@api_router.post("/generate/blueprint")
@limiter.limit("10/minute")
async def generate_blueprint(request: Request, ...):
    ...
```

### 3d — Static File Storage

The backend writes generated illustrations and character reference sheets to the local filesystem (`backend/static/`).  
On Railway, attach a **persistent volume** mounted at `/app/static` so files survive deploys and restarts (see Step 2.7 below for the matching code change).

For scale, swap the local mount for **S3 / R2 / GCS** bucket storage and serve images through a CDN URL instead of the FastAPI `/static` mount.

---

## 4. Step-by-Step Production Deployment

### Step 1 — MongoDB Atlas

1. Create a free account at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a **Shared (M0)** cluster in the region closest to your backend server.
3. Add a database user with a strong password.
4. **MongoDB Atlas network access:** In Atlas → Network Access, add Railway's outbound IP(s).  
   On Railway's Hobby plan IPs are shared and may rotate — use `0.0.0.0/0` to allow any IP, then lock it down to [Railway's static egress IPs](https://docs.railway.com/reference/static-outbound-ips) (available on the Team plan) once you are ready to tighten security.
   A stronger alternative is Atlas [Private Endpoint / VPC Peering](https://www.mongodb.com/docs/atlas/security-vpc-peering/) which routes traffic over a private network and avoids public IP exposure entirely.
5. Copy the **SRV connection string** — you will need it in Step 2.

### Step 2 — Deploy the Backend to Railway

1. Push this repository to GitHub (it already is at `Bboy9090/Rainstorms`).
2. Go to [railway.app](https://railway.app) → New Project → **Deploy from GitHub repo**.
3. Select `Bboy9090/Rainstorms` and choose the `backend` subdirectory as the root.
4. Railway auto-detects Python and runs `pip install -r requirements.txt`.
5. Set the **Start Command**:
   ```
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
6. Add all backend environment variables (from §3a) in the Railway dashboard → Variables tab.
7. Under **Volumes**, add a persistent volume mounted at `/app/static`.  
   Because Railway uses the `backend/` subdirectory as the service root, `server.py` lives at `/app/server.py`, so `ROOT_DIR = Path(__file__).parent` resolves to `/app/` and `ROOT_DIR / "static"` is already `/app/static` — no code change required.
8. After the first successful deploy, Railway gives you a URL like `https://rainstorms-api.railway.app`.  
   Set a **custom domain** (e.g., `api.rainstorms.app`) in Railway → Settings → Domains.

### Step 3 — Build and Deploy the Frontend to Vercel

1. In the `frontend/` directory, build the static web bundle:
   ```bash
   cd frontend
   EXPO_PUBLIC_BACKEND_URL=https://api.rainstorms.app npx expo export --platform web
   # Output → frontend/dist/
   ```
2. Go to [vercel.com](https://vercel.com) → New Project → Import `Bboy9090/Rainstorms`.
3. Set the **Root Directory** to `frontend`.
4. Set the **Build Command** to `npx expo export --platform web`.
5. Set the **Output Directory** to `dist`.
6. Add the `EXPO_PUBLIC_BACKEND_URL` environment variable.
7. Deploy. Vercel gives you `https://rainstorms.vercel.app`.
8. Add your **custom domain** (e.g., `rainstorms.app`) in Vercel → Settings → Domains.

### Step 4 — Verify End-to-End

1. Open your production URL.
2. Register a new account and create a project.
3. Run through the full pipeline: Idea Lab → Blueprint → Characters → Page Builder → Export.
4. Test the demo project path (no API key required).
5. Download a PDF and verify it renders correctly.

---

## 5. Custom Domain (Recommended)

A real domain makes the app look professional and trustworthy.

| Step | Action |
|------|--------|
| Buy a domain | [Namecheap](https://www.namecheap.com) or [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) (`rainstorms.app` costs ~$12/year) |
| Point frontend | Add `rainstorms.app` → Vercel via CNAME/A record |
| Point backend | Add `api.rainstorms.app` → Railway via CNAME |
| SSL | Vercel and Railway handle TLS certificates automatically via Let's Encrypt |

---

## 6. Mobile App (Phase 2 — Optional)

Once the web version is live and validated, publish to the app stores.  
No code rewrite is needed — Expo supports this out of the box.

### Setup

```bash
# Install Expo Application Services CLI
npm install -g eas-cli

# Log in to your Expo account
eas login

# Configure builds
cd frontend
eas build:configure
```

### Build

```bash
# iOS (requires Apple Developer account — $99/yr)
eas build --platform ios --profile production

# Android (requires Google Play Console account — $25 one-time)
eas build --platform android --profile production
```

### Submit

```bash
eas submit --platform ios      # uploads .ipa to App Store Connect
eas submit --platform android  # uploads .aab to Google Play Console
```

Update `frontend/app.json` with your real app name, bundle ID, and version before submitting:

```json
{
  "expo": {
    "name": "Rainstorms",
    "slug": "rainstorms",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.yourdomain.rainstorms",
      "supportsTablet": true
    },
    "android": {
      "package": "com.yourdomain.rainstorms"
    }
  }
}
```

---

## 7. Estimated Monthly Cost

| Service | Free tier | Paid tier |
|---------|-----------|-----------|
| Vercel (frontend) | 100 GB bandwidth, unlimited deploys | $20/mo (Pro) |
| Railway (backend) | $5 credit/month | ~$5–20/mo (Hobby) |
| MongoDB Atlas | M0: 512 MB shared | $57/mo (M10 dedicated) |
| Emergent / OpenAI | Pay-per-token | ~$10–50/mo depending on usage |
| Domain | — | ~$12/year |
| **Total (starter)** | **~$0–5/mo** | **~$40–100/mo at scale** |

---

## 8. What to Do Right Now

Here is the **minimum viable launch sequence**:

1. ☐ Create MongoDB Atlas M0 cluster and copy the connection string
2. ☐ Generate a strong `JWT_SECRET` (`python -c "import secrets; print(secrets.token_hex(32))"`)
3. ☐ Lock CORS to your frontend domain (see §3b)
4. ☐ Deploy backend to Railway with environment variables set
5. ☐ Build frontend web bundle and deploy to Vercel
6. ☐ Point `api.yourdomain.com` → Railway and `yourdomain.com` → Vercel
7. ☐ Test the full pipeline end-to-end on the production URL
8. ☐ (Optional) Buy and connect a custom domain

Once steps 1–7 are done you have a **fully operational, publicly accessible SaaS** that anyone can use from their browser on any device — desktop, tablet, or phone.

---

*See [ROADMAP.md](ROADMAP.md) for what to build next after launch.*  
*See [APP_VISION.md](APP_VISION.md) for the product philosophy and target users.*
