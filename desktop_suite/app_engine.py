"""Bobby's Story Bench (Rainstorms) — Illustrated Book & Narrative Blueprint Studio."""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
import platform_exclusive

def _db() -> Path:
    return platform_exclusive.local_data_dir("bobbys-story-bench") / "stories.json"

def load_stories() -> list:
    p = _db()
    if p.exists():
        try: return json.loads(p.read_text(encoding="utf-8"))
        except Exception: pass
    return []

def start_server(port: int, bundle_root: Path, meta: dict):
    app = Flask(__name__)
    ui_dir, assets_dir = bundle_root / "ui", bundle_root / "assets"

    @app.route("/")
    def index(): return send_from_directory(ui_dir, "index.html")
    @app.route("/assets/<path:f>")
    def assets(f): return send_from_directory(assets_dir, f)
    @app.route("/api/health")
    def health(): return jsonify({"ok": True, "app": meta["title"]})
    @app.route("/api/platform")
    def plat(): return jsonify(platform_exclusive.get_system_overview())
    @app.route("/api/chapters", methods=["GET", "POST"])
    def chapters():
        items = load_stories()
        if request.method == "GET": return jsonify({"chapters": items})
        b = request.get_json(force=True, silent=True) or {}
        items.insert(0, {
            "id": f"ch{int(datetime.now().timestamp())}",
            "book": b.get("book") or "Untitled Book",
            "chapter": b.get("chapter") or "New Chapter",
            "art_prompt": b.get("art_prompt") or "",
            "prose": b.get("prose") or "",
        })
        _db().write_text(json.dumps(items, indent=2), encoding="utf-8")
        return jsonify({"ok": True, "chapters": items})

    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
