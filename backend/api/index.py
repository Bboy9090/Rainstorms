"""Vercel ASGI entry point for the Rainstorms FastAPI backend.

Vercel's Python runtime looks for a file inside the `api/` directory.
This module adds the parent `backend/` directory to sys.path so that
server.py (and its sibling modules ai_helper.py / lore_engine.py) can
be imported normally, then re-exports the FastAPI `app` object.
"""
import sys
import os

# Make backend/ importable (parent of this file's directory)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app  # noqa: F401  - Vercel detects `app` as the ASGI handler
