# Troubleshooting Guide

Common issues when setting up and running Rainstorms, and how to fix them.

---

## Setup Issues

### Backend won't start

#### Error: `ModuleNotFoundError: No module named 'fastapi'`

**Cause**: Dependencies not installed or virtual environment not activated.

**Solution**:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

#### Error: `pymongo.errors.ServerSelectionTimeoutError`

**Cause**: MongoDB is not running or `MONGO_URL` is incorrect.

**Solution for local MongoDB**:
```bash
# Start MongoDB (if installed locally)
mongod

# Or in background (macOS/Linux)
brew services start mongodb-community  # macOS with Homebrew
sudo systemctl start mongod            # Linux with systemd
```

**Solution for MongoDB Atlas**:
1. Check your connection string in `backend/.env`:
   ```bash
   MONGO_URL=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net
   ```
2. Verify your IP is whitelisted in MongoDB Atlas:
   - Go to Atlas dashboard → Network Access
   - Add your IP or use `0.0.0.0/0` for testing (not recommended for production)
3. Check username and password are correct

#### Error: `pydantic.errors.PydanticUserError: [...]`

**Cause**: Pydantic version mismatch or outdated dependencies.

**Solution**:
```bash
cd backend
source .venv/bin/activate
pip install --upgrade -r requirements.txt
```

#### Backend starts but health check fails

**Symptom**: Backend server starts but http://localhost:8001/api/health returns 404 or times out.

**Solution**:
1. Check the server logs for errors
2. Verify the backend is listening on the correct port:
   ```bash
   # Should show: uvicorn running on http://0.0.0.0:8001
   ```
3. Try accessing http://localhost:8001/docs (Swagger UI)
4. Check firewall rules aren't blocking port 8001

---

## Frontend Issues

### Frontend won't start

#### Error: `npm ERR! Could not resolve dependency`

**Cause**: Peer dependency conflicts in React Native / Expo.

**Solution**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

#### Error: `EXPO_PUBLIC_BACKEND_URL is not defined`

**Cause**: `.env` file missing or not loaded correctly.

**Solution**:
```bash
cd frontend
cp .env.example .env
# Verify the file contains:
cat .env  # Should show: EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

#### Error: `expo` command not found

**Cause**: Expo CLI not installed globally.

**Solution**:
```bash
# Use npx instead (recommended):
npx expo start --web

# Or install globally:
npm install -g expo-cli
```

---

## Connection Issues

### Frontend can't reach backend

#### Error: Network request failed / CORS error

**Symptom**: Frontend loads but API calls fail with network errors.

**Diagnostic steps**:
1. Check backend is running: http://localhost:8001/api/health
2. Check frontend `.env`:
   ```bash
   cat frontend/.env
   # Should show: EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
   ```
3. Check browser console for specific errors
4. Verify CORS is enabled in backend (it should be by default)

**Solution**:
```bash
# Restart both servers:
# Terminal 1 (backend):
cd backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 (frontend):
cd frontend
npx expo start --web
```

#### Error: Cannot connect to localhost from mobile device

**Symptom**: Works on web (localhost:8081) but not on mobile via Expo Go.

**Cause**: Mobile device can't access `localhost` on your computer.

**Solution**:
1. Find your computer's local IP address:
   ```bash
   # macOS/Linux:
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows:
   ipconfig
   ```

2. Update `frontend/.env` to use your local IP:
   ```bash
   # Replace with your actual IP:
   EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:8001
   ```

3. Restart the frontend:
   ```bash
   npx expo start --web
   ```

4. Scan the QR code with Expo Go

---

## API / Generation Issues

### "Generate Blueprint" does nothing

**Symptom**: Clicking "Generate Story Blueprint" shows loading spinner forever.

**Diagnostic steps**:
1. Check backend logs for errors
2. Verify API key is set:
   ```bash
   grep OPENAI_API_KEY backend/.env
   # Should show: OPENAI_API_KEY=sk-...
   ```
3. Test the health endpoint: http://localhost:8001/api/health
4. Check OpenAI API status: https://status.openai.com/

**Solution**:
```bash
# 1. Verify API key is correct
cat backend/.env | grep OPENAI_API_KEY

# 2. Test the API key manually:
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
# Should return a list of models

# 3. Restart backend
cd backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Error: `openai.error.RateLimitError`

**Cause**: OpenAI rate limit exceeded or insufficient credits.

**Solution**:
1. Check your OpenAI account: https://platform.openai.com/account/usage
2. Add credits if needed
3. Wait a few minutes and retry
4. Consider switching to Gemini:
   ```bash
   # In backend/.env:
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=your_gemini_key_here
   ```

### Error: `openai.error.InvalidRequestError`

**Symptom**: API calls fail with "invalid request" errors.

**Causes & Solutions**:
- **Token limit exceeded**: Your prompt is too long
  - Try reducing page count or simplifying the idea
- **Invalid model**: Model name is incorrect
  - Check `backend/ai_helper.py` for correct model names
- **Deprecated model**: Model no longer available
  - Update to latest Rainstorms version

---

## Export Issues

### PDF export fails

#### Error: `reportlab` module errors

**Cause**: ReportLab not installed or corrupted.

**Solution**:
```bash
cd backend
source .venv/bin/activate
pip install --upgrade reportlab
```

#### Export returns 500 error

**Symptom**: Export endpoint fails with internal server error.

**Solution**:
1. Check backend logs for specific error
2. Verify all pages have been generated:
   - Navigate to Page Builder
   - Ensure all pages have text
3. Try a different export format (JSON instead of PDF)

### Downloaded PDF is empty or corrupted

**Cause**: File encoding issue or incomplete generation.

**Solution**:
1. Ensure all pages are fully generated before exporting
2. Check backend logs during export
3. Try exporting as JSON first to verify data integrity:
   ```bash
   curl http://localhost:8001/api/projects/{project_id}/export/json
   ```

---

## Illustration Issues

### Illustrations won't generate

#### Error: 401 Unauthorized from OpenAI

**Cause**: `OPENAI_API_KEY` not set or invalid.

**Solution**:
```bash
# Check API key exists
grep OPENAI_API_KEY backend/.env

# Test key manually:
curl https://api.openai.com/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "model": "dall-e-3",
    "prompt": "a white siamese cat",
    "n": 1,
    "size": "1024x1024"
  }'
```

#### Illustrations generate but don't display

**Symptom**: Backend creates images but they don't show in frontend.

**Solution**:
1. Check backend logs for image save location
2. Verify `/static` directory exists and is served:
   ```bash
   ls -la backend/static/illustrations/
   ```
3. Check browser console for 404 errors on image URLs
4. Verify `buildImageUrl()` in `frontend/src/utils/api.ts` is correct

---

## Performance Issues

### Generation is very slow

**Symptom**: Each page takes 30+ seconds to generate.

**Causes**:
- API provider latency (OpenAI/Gemini)
- Network issues
- MongoDB slow queries

**Solutions**:
1. Check API provider status:
   - OpenAI: https://status.openai.com/
   - Google: https://status.cloud.google.com/
2. Try switching providers:
   ```bash
   # In backend/.env:
   LLM_PROVIDER=gemini  # Often faster than OpenAI
   ```
3. Reduce page count for testing
4. Use batch generation instead of one-by-one

### Frontend is laggy

**Symptom**: UI is slow or unresponsive.

**Solutions**:
1. Clear browser cache and reload
2. Check browser console for errors
3. Reduce project size (fewer pages)
4. Close other browser tabs
5. Try in a different browser

---

## Authentication Issues

### Can't create account

#### Error: Email already exists

**Solution**: Use the login form instead, or choose a different email.

#### Error: Weak password

**Cause**: Password doesn't meet minimum requirements.

**Solution**: Use a password with at least 8 characters.

### JWT token expired

**Symptom**: 401 errors after being logged in for a while.

**Cause**: JWT tokens expire after 72 hours.

**Solution**: Log out and log back in to get a new token.

### Lost password / locked out

**Solution**:
- There's no password reset feature in v0.1.0
- Register with a new email
- Or use the demo project (no account needed)

---

## MongoDB Issues

### Database connection keeps dropping

**Symptom**: Intermittent connection errors.

**Solutions**:
1. **For local MongoDB**:
   - Ensure MongoDB service is running continuously
   - Check system resources (MongoDB needs ~500MB RAM)

2. **For MongoDB Atlas**:
   - Check network connectivity
   - Verify your IP hasn't changed (re-whitelist if needed)
   - Consider using `0.0.0.0/0` for testing (not production!)

### Database queries are slow

**Symptom**: API requests take several seconds.

**Solutions**:
1. Check MongoDB indexes:
   ```javascript
   // Connect to MongoDB
   use rainstorms_db;
   db.projects.getIndexes();
   ```
2. For local MongoDB, ensure you're not running out of disk space
3. For MongoDB Atlas, check your cluster tier (free tier has limits)

---

## Port Conflicts

### Error: Port 8001 already in use

**Symptom**: Backend won't start with "Address already in use" error.

**Solution**:
```bash
# Find process using port 8001:
lsof -ti:8001

# Kill the process:
kill -9 $(lsof -ti:8001)

# Or use a different port:
uvicorn server:app --host 0.0.0.0 --port 8002 --reload
# Then update frontend/.env: EXPO_PUBLIC_BACKEND_URL=http://localhost:8002
```

### Error: Port 8081 already in use

**Symptom**: Frontend won't start with port conflict.

**Solution**:
```bash
# Expo will automatically try the next available port
# Or specify a different port:
npx expo start --web --port 8082
```

---

## Environment Variable Issues

### Changes to .env not taking effect

**Symptom**: Updated `.env` but behavior doesn't change.

**Solution**:
1. **Backend**: Restart the uvicorn server (Ctrl+C and re-run)
2. **Frontend**: Restart Expo dev server (Ctrl+C and re-run)
3. Clear any cached builds:
   ```bash
   # Frontend:
   cd frontend
   rm -rf .expo .metro-cache
   npm start
   ```

### Can't tell if .env is loaded

**Diagnostic**:
```bash
# Backend:
cd backend
source .venv/bin/activate
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('MONGO_URL:', os.getenv('MONGO_URL'))"

# Frontend:
cd frontend
cat .env
```

---

## Getting More Help

If you're still stuck after trying these solutions:

1. **Check the logs**:
   - Backend: Terminal where `uvicorn` is running
   - Frontend: Browser console (F12 → Console tab)
   - MongoDB: Check MongoDB logs

2. **Enable debug logging**:
   ```bash
   # Backend (in server.py):
   logging.basicConfig(level=logging.DEBUG)
   ```

3. **Run the test suite**:
   ```bash
   python backend_test.py
   # This tests all API endpoints
   ```

4. **Open an issue**:
   - Go to https://github.com/Bboy9090/Rainstorms/issues
   - Include:
     - Error message (full traceback)
     - Steps to reproduce
     - OS and versions (Python, Node, MongoDB)
     - Backend logs
     - Browser console output

5. **Check existing issues**:
   - Your problem might already be solved
   - Search: https://github.com/Bboy9090/Rainstorms/issues

---

## Quick Diagnostic Commands

Run these to quickly check your setup:

```bash
# 1. Check Python version
python3 --version  # Should be 3.10+

# 2. Check Node version
node --version     # Should be 18+

# 3. Check backend .env
cat backend/.env | grep -E "MONGO_URL|OPENAI_API_KEY|LLM_PROVIDER"

# 4. Check frontend .env
cat frontend/.env | grep EXPO_PUBLIC_BACKEND_URL

# 5. Check if ports are available
lsof -ti:8001      # Should be empty (or show uvicorn PID if running)
lsof -ti:8081      # Should be empty (or show expo PID if running)

# 6. Test backend health
curl http://localhost:8001/api/health

# 7. Test MongoDB connection
mongosh --eval "db.version()"  # Or mongo --version for older versions

# 8. Check disk space
df -h              # Make sure you have >1GB free
```

Or simply run:
```bash
bash verify-setup.sh
```

---

## Prevention Tips

Avoid common issues:

1. **Always activate the venv** before running backend commands:
   ```bash
   cd backend
   source .venv/bin/activate
   ```

2. **Use `--legacy-peer-deps`** for all npm installs:
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Keep dependencies updated**:
   ```bash
   cd backend
   pip install --upgrade -r requirements.txt

   cd frontend
   npm update --legacy-peer-deps
   ```

4. **Don't commit `.env` files**:
   - They're in `.gitignore` for a reason
   - Never share API keys publicly

5. **Test after each change**:
   - Make one change at a time
   - Test immediately
   - Roll back if something breaks

---

**Still need help?** Open an issue with full details: https://github.com/Bboy9090/Rainstorms/issues
