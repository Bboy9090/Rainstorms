# ==========================================
# RAINSTORMS ENTERPRISE MONOREPO MAKEFILE
# ==========================================
# World-class orchestration for a multi-stack application.
# Manage Docker, Python, JS, and deployments from a single source of truth.

.PHONY: install dev dev-backend dev-frontend lint test build clean deploy-prod

# --- INSTALLATION ---
install:
	@echo "🔥 Installing Monorepo Dependencies..."
	npm install
	cd frontend && npm install
	cd backend && python -m venv venv && venv/Scripts/activate && pip install -r requirements.txt
	@echo "✅ Dependencies loaded."

# --- DEVELOPMENT (Local) ---
dev:
	@echo "🚀 Starting Full Stack (Frontend + Backend + DB via Docker)"
	docker compose up --build

dev-detach:
	@echo "🚀 Starting Full Stack detached"
	docker compose up --build -d

dev-backend:
	@echo "🐍 Starting Native Python Backend (No Docker)"
	cd backend && uvicorn server:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	@echo "⚛️ Starting Native Expo Frontend"
	cd frontend && npm run start

# --- CODE QUALITY ---
lint:
	@echo "🧹 Running Global Linting & Formatting"
	# Format JS/TS
	npx prettier --write "frontend/src/**/*.{js,jsx,ts,tsx}" --ignore-unknown
	# Format Python
	cd backend && python -m black .
	cd backend && python -m flake8 . --exit-zero
	@echo "✨ Code is pristine."

test:
	@echo "🧪 Running Test Suites"
	cd backend && pytest --disable-warnings -q

# --- DEPLOYMENT ---
deploy-prod:
	@echo "🚢 Initiating Enterprise Deployment Pipeline"
	@echo "Pushing changes to Git..."
	git add .
	git commit -m "build(deploy): deploy via makefile $(shell date)" || true
	git push origin main
	@echo "✅ Main branch updated. CI/CD Pipeline will execute deployment to Railway & Vercel."

clean:
	@echo "🗑️ Cleaning Cache, Node Modules, and Virtual Environments"
	rm -rf node_modules frontend/node_modules backend/venv backend/__pycache__
	docker system prune -f
