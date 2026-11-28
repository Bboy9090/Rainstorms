"""Bobby's Story Bench (Rainstorms) — 3-Pane Illustrated Book & Manuscript Studio."""
from __future__ import annotations

import json
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
import platform_exclusive


def _db() -> Path:
    p = platform_exclusive.local_data_dir("bobbys-story-bench") / "stories.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def load_stories() -> list[dict]:
    p = _db()
    if p.exists():
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
        except Exception:
            pass
    return []


def save_stories(items: list[dict]) -> None:
    """Atomic save (aligned with MacBook PR #73 data-integrity protection)."""
    p = _db()
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix="stories_", suffix=".tmp", dir=str(p.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, ensure_ascii=False)
        os.replace(tmp_name, p)
    except Exception:
        Path(tmp_name).unlink(missing_ok=True)
        raise


def start_server(port: int, bundle_root: Path, meta: dict):
    app = Flask(__name__)
    ui_dir, assets_dir = bundle_root / "ui", bundle_root / "assets"

    @app.route("/")
    def index():
        return send_from_directory(ui_dir, "index.html")

    @app.route("/assets/<path:f>")
    def assets(f):
        return send_from_directory(assets_dir, f)

    @app.route("/api/health")
    def health():
        return jsonify({"ok": True, "app": meta["title"], "storage_path": str(_db())})

    @app.route("/api/platform")
    def plat():
        return jsonify(platform_exclusive.get_system_overview())

    @app.route("/api/chapters", methods=["GET", "POST"])
    def chapters():
        items = load_stories()
        if request.method == "GET":
            return jsonify({"ok": True, "chapters": items, "storage_path": str(_db())})
        b = request.get_json(force=True, silent=True) or {}
        now = datetime.now().isoformat(timespec="seconds")
        chap = {
            "id": f"ch-{uuid.uuid4().hex[:8]}",
            "book": (b.get("book") or "Untitled Book").strip(),
            "chapter": (b.get("chapter") or "New Chapter").strip(),
            "art_prompt": (b.get("art_prompt") or "").strip(),
            "illustration_data_url": b.get("illustration_data_url") or "",
            "notes": (b.get("notes") or "").strip(),
            "prose": b.get("prose") or "",
            "updated_at": now,
        }
        items.append(chap)
        save_stories(items)
        return jsonify({"ok": True, "chapter": chap, "chapters": items})

    @app.route("/api/chapters/<chap_id>", methods=["PUT", "DELETE"])
    def chapter_item(chap_id: str):
        items = load_stories()
        idx = next((i for i, c in enumerate(items) if c.get("id") == chap_id), -1)
        if idx < 0:
            return jsonify({"ok": False, "error": f"Chapter not found: {chap_id}"}), 404
        if request.method == "DELETE":
            removed = items.pop(idx)
            save_stories(items)
            return jsonify({"ok": True, "deleted": removed["id"], "chapters": items})
        b = request.get_json(force=True, silent=True) or {}
        cur = items[idx]
        cur["book"] = (b.get("book", cur.get("book")) or "Untitled Book").strip()
        cur["chapter"] = (b.get("chapter", cur.get("chapter")) or "Untitled Chapter").strip()
        cur["art_prompt"] = (b.get("art_prompt", cur.get("art_prompt")) or "").strip()
        if "illustration_data_url" in b:
            cur["illustration_data_url"] = b.get("illustration_data_url") or ""
        if "notes" in b:
            cur["notes"] = (b.get("notes") or "").strip()
        cur["prose"] = b.get("prose", cur.get("prose")) or ""
        cur["updated_at"] = datetime.now().isoformat(timespec="seconds")
        save_stories(items)
        return jsonify({"ok": True, "chapter": cur, "chapters": items})

    @app.route("/api/export", methods=["POST"])
    def export_manuscript():
        b = request.get_json(force=True, silent=True) or {}
        fmt = str(b.get("format") or "md").lower()
        items = load_stories()
        export_dir = platform_exclusive.local_data_dir("bobbys-story-bench") / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if fmt == "json":
            out_path = export_dir / f"manuscript_{stamp}.json"
            out_path.write_text(json.dumps({"exported_at": datetime.now().isoformat(), "chapters": items}, indent=2), encoding="utf-8")
        elif fmt == "html":
            out_path = export_dir / f"manuscript_{stamp}.html"
            sections = []
            for c in items:
                img_html = f'<img src="{c["illustration_data_url"]}" style="max-width:100%;border-radius:10px;margin:12px 0;" />' if c.get("illustration_data_url") else ""
                prose_html = "<p>" + "</p><p>".join(ln for ln in (c.get("prose") or "").splitlines() if ln.strip()) + "</p>"
                sections.append(f"<section><h2>{c.get('book','')} — {c.get('chapter','')}</h2><blockquote>{c.get('art_prompt','')}</blockquote>{img_html}{prose_html}</section>")
            html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Compiled Manuscript</title><style>body{font-family:Georgia,serif;max-width:740px;margin:40px auto;line-height:1.7;color:#111;padding:0 20px;}blockquote{color:#555;border-left:3px solid #D6B879;padding-left:12px;}</style></head><body>" + "\n<hr>\n".join(sections) + "</body></html>"
            out_path.write_text(html, encoding="utf-8")
        else:
            out_path = export_dir / f"manuscript_{stamp}.md"
            md = "\n\n---\n\n".join(
                f"# {c.get('book','')} — {c.get('chapter','')}\n\n> **Art Direction:** {c.get('art_prompt','')}\n\n{c.get('prose','')}"
                for c in items
            )
            out_path.write_text(md, encoding="utf-8")
        return jsonify({"ok": True, "path": str(out_path), "bytes": out_path.stat().st_size, "chapter_count": len(items)})

    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
