# Railway + Vercel Deployment — Complete Setup

> **If stories aren't generating:** Work through this checklist in order.

---

## 1. Backend on Railway

### 1a. Environment Variables (Railway → Backend Service → Variables)

| Variable      | Value | Required |
|---------------|-------|----------|
| `MONGO_URL`   | `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?appName=Cluster0` | ✅ Yes |
| `DB_NAME`     | `rainstorms_db` | Optional (default) |
| `JWT_SECRET`  | Long random string — run: `python3 -c "import secrets; print(secrets.token_hex(32))"` | ✅ Yes |
| `LLM_PROVIDER` | `groq` (free tier) or `openai` / `gemini` | ✅ Yes |
| `GROQ_API_KEY` | Your Groq key from [console.groq.com](https://console.groq.com) | ✅ For Groq |
| `OPENAI_API_KEY` | Your OpenAI key | Only when LLM_PROVIDER=openai |

**Use Groq (free):** Set `LLM_PROVIDER=groq` and `GROQ_API_KEY`. No credit card needed.  
**MONGO_URL:** Replace `USER` and `PASSWORD` with your MongoDB Atlas credentials.  
If your password has `@`, `#`, or `%`, [URL-encode](https://www.w3schools.com/tags/ref_urlencode.asp) it.

### 1b. MongoDB Atlas Network Access

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → your project
2. **Network Access** (left sidebar under Security)
3. **Add IP Address** → **Allow Access from Anywhere** (adds `0.0.0.0/0`)
4. Save

Railway's IPs change; allowing `0.0.0.0/0` lets Railway connect. Lock down later with [Railway static IPs](https://docs.railway.app/reference/static-egress-ips) if needed.

### 1c. Verify Backend

After setting variables and redeploying:

```bash
# Health (minimal)
curl https://backend-production-4938.up.railway.app/api/health

# Ready (MongoDB + LLM config)
curl https://backend-production-4938.up.railway.app/api/ready

# LLM config (if story generation fails)
curl https://backend-production-4938.up.railway.app/api/llm-check
```

- **Health OK, Ready 503** → MongoDB or LLM not configured. Recheck variables.
- **llm-check shows `"configured": false`** → Add `LLM_PROVIDER=groq` and `GROQ_API_KEY` in Railway.
- **Both OK** → Backend is good.

---

## 2. Frontend on Vercel

### 2a. Environment Variable (Vercel → Project → Settings → Environment Variables)

| Name | Value | Environments |
|------|-------|--------------|
| `EXPO_PUBLIC_BACKEND_URL` | `https://backend-production-4938.up.railway.app` | Production, Preview, Development |

**No trailing slash.** This is baked into the build at deploy time.

### 2b. Purge Build Cache (if it still uses wrong URL)

1. Vercel → your project → **Settings** → **General**
2. Scroll to **Build Cache** → **Purge cache**
3. **Deployments** → latest deployment → **⋯** → **Redeploy**

### 2c. Vercel Project Settings

- **Root Directory:** `frontend`
- **Build Command:** (uses `frontend/vercel.json` — already correct)
- **Output Directory:** `dist`

---

## 3. Quick Test

1. Open https://rainstorms.vercel.app
2. Click **Try Demo Project**
3. You should see the Captain Blanket blueprint, then characters, then page builder.

If it spins forever or errors: backend can’t reach MongoDB → re-check §1.

---

## 4. Your URLs (current setup)

| Service | URL |
|---------|-----|
| Frontend | https://rainstorms.vercel.app |
| Backend  | https://backend-production-4938.up.railway.app |
| API docs | https://backend-production-4938.up.railway.app/docs |
