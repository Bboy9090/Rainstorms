#!/bin/bash
set -e

cd backend
pip install -r requirements.txt --quiet --no-deps 2>/dev/null || true

cd ../frontend
npm install --legacy-peer-deps --ignore-scripts --quiet 2>/dev/null || true
