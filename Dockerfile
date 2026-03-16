# Rainstorms Backend — production Docker image
# Use Python 3.12 slim for smaller image, compatible with Groq/Atlas
FROM python:3.12-slim

WORKDIR /app

# Install deps only (faster rebuilds when code changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create static dirs (server expects these)
RUN mkdir -p static/illustrations static/characters

# Railway/fly.io/etc inject PORT; default 8000 for local
ENV PORT=8000
EXPOSE 8000

# Run uvicorn (shell form so $PORT expands)
CMD sh -c "uvicorn server:app --host 0.0.0.0 --port ${PORT}"
