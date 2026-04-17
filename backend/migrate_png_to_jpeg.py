#!/usr/bin/env python3
"""
One-time migration: convert PNG data-URI images stored in the database to JPEG.

Affected collections / fields
  - pages       → illustration_url
  - books       → front_cover_url
  - characters  → reference_sheet_url

The script works with both database backends:
  • MongoDB Atlas  (when MONGO_URL points to a valid Atlas cluster)
  • Replit PostgreSQL  (fallback — documents stored in a JSONB `documents` table)

Usage:
    cd backend
    python migrate_png_to_jpeg.py

    # Dry-run (inspect without writing):
    python migrate_png_to_jpeg.py --dry-run
"""

import asyncio
import base64
import json
import logging
import os
import sys
from io import BytesIO
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image

load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("png_to_jpeg")

DRY_RUN = "--dry-run" in sys.argv

JPEG_QUALITY = 85

TARGETS = [
    ("pages",      "illustration_url"),
    ("books",      "front_cover_url"),
    ("characters", "reference_sheet_url"),
]


# ── image helpers ─────────────────────────────────────────────────────────────

def _parse_data_uri(uri: str):
    """Return (mime_type, raw_bytes) for a data URI, or (None, None) on failure."""
    if not uri or not uri.startswith("data:"):
        return None, None
    try:
        header, b64 = uri.split(",", 1)
        mime = header.split(";")[0][5:]
        return mime, base64.b64decode(b64)
    except Exception:
        return None, None


def _compress_to_jpeg(image_bytes: bytes) -> tuple:
    """Convert raw image bytes to JPEG at JPEG_QUALITY.

    Returns (jpeg_bytes, "jpeg") on success or (None, None) on failure.
    """
    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        out = BytesIO()
        img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        return out.getvalue(), "jpeg"
    except Exception as exc:
        logger.warning("JPEG compression failed: %s", exc)
        return None, None


def _to_jpeg_data_uri(png_uri: str):
    """Convert a PNG data URI to a JPEG data URI.

    Returns (jpeg_uri, original_bytes, jpeg_bytes) or (None, 0, 0) on failure.
    """
    mime, raw = _parse_data_uri(png_uri)
    if mime != "image/png":
        return None, 0, 0
    jpeg_bytes, _ = _compress_to_jpeg(raw)
    if jpeg_bytes is None:
        return None, 0, 0
    jpeg_uri = "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode()
    return jpeg_uri, len(raw), len(jpeg_bytes)


# ── database-specific migration ───────────────────────────────────────────────

async def _migrate_mongo(db, dry_run: bool):
    """Migrate PNG images in a Motor / MongoDB database."""
    total_converted = 0
    total_saved_bytes = 0

    for collection_name, field in TARGETS:
        col = db[collection_name]
        # Find documents whose field starts with a PNG data URI
        docs = await col.find(
            {field: {"$regex": r"^data:image/png;base64,"}}
        ).to_list(length=None)

        converted = 0
        saved = 0

        for doc in docs:
            uri = doc.get(field, "")
            jpeg_uri, orig_len, jpeg_len = _to_jpeg_data_uri(uri)
            if jpeg_uri is None:
                continue

            doc_id = doc.get("id") or doc.get("_id")
            logger.info(
                "  %s/%s  %s → %s bytes  (saved %s bytes)",
                collection_name, doc_id,
                orig_len, jpeg_len, orig_len - jpeg_len,
            )

            if not dry_run:
                await col.update_one(
                    {"id": doc_id} if "id" in doc else {"_id": doc_id},
                    {"$set": {field: jpeg_uri}},
                )

            converted += 1
            saved += orig_len - jpeg_len

        logger.info(
            "[%s] converted %d image(s), saved ~%.1f KB",
            collection_name, converted, saved / 1024,
        )
        total_converted += converted
        total_saved_bytes += saved

    return total_converted, total_saved_bytes


async def _migrate_pg(pool, dry_run: bool):
    """Migrate PNG images stored in the PostgreSQL JSONB documents table."""
    total_converted = 0
    total_saved_bytes = 0

    async with pool.acquire() as conn:
        for collection_name, field in TARGETS:
            rows = await conn.fetch(
                "SELECT doc_id, data FROM documents WHERE collection = $1",
                collection_name,
            )

            converted = 0
            saved = 0

            for row in rows:
                doc = json.loads(row["data"])
                uri = doc.get(field, "")
                jpeg_uri, orig_len, jpeg_len = _to_jpeg_data_uri(uri)
                if jpeg_uri is None:
                    continue

                doc_id = row["doc_id"]
                logger.info(
                    "  %s/%s  %s → %s bytes  (saved %s bytes)",
                    collection_name, doc_id,
                    orig_len, jpeg_len, orig_len - jpeg_len,
                )

                if not dry_run:
                    doc[field] = jpeg_uri
                    await conn.execute(
                        "UPDATE documents SET data = $1::jsonb, updated_at = NOW() "
                        "WHERE collection = $2 AND doc_id = $3",
                        json.dumps(doc), collection_name, doc_id,
                    )

                converted += 1
                saved += orig_len - jpeg_len

            logger.info(
                "[%s] converted %d image(s), saved ~%.1f KB",
                collection_name, converted, saved / 1024,
            )
            total_converted += converted
            total_saved_bytes += saved

    return total_converted, total_saved_bytes


# ── entry point ───────────────────────────────────────────────────────────────

async def main():
    if DRY_RUN:
        logger.info("DRY-RUN mode — no changes will be written to the database.")

    mongo_url = os.environ.get("MONGO_URL", "")
    use_mongo = mongo_url.startswith("mongodb+srv://") or (
        mongo_url.startswith("mongodb://") and "localhost" not in mongo_url
    )

    if use_mongo:
        logger.info("Database backend: MongoDB Atlas")
        import certifi
        from motor.motor_asyncio import AsyncIOMotorClient

        tls_kwargs = {}
        if mongo_url.startswith("mongodb+srv://"):
            tls_kwargs["tlsCAFile"] = certifi.where()
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=15000, **tls_kwargs)
        db_name = os.environ.get("DB_NAME", "rainstorms_db")
        db = client[db_name]
        total_converted, total_saved = await _migrate_mongo(db, DRY_RUN)
        client.close()
    else:
        logger.info("Database backend: Replit PostgreSQL")
        import asyncpg

        dsn = os.environ.get("DATABASE_URL", "")
        if dsn:
            pool = await asyncpg.create_pool(dsn, min_size=1, max_size=5)
        else:
            pool = await asyncpg.create_pool(
                host=os.environ.get("PGHOST"),
                port=int(os.environ.get("PGPORT", 5432)),
                database=os.environ.get("PGDATABASE"),
                user=os.environ.get("PGUSER"),
                password=os.environ.get("PGPASSWORD"),
                min_size=1,
                max_size=5,
            )
        total_converted, total_saved = await _migrate_pg(pool, DRY_RUN)
        await pool.close()

    mode = "DRY-RUN" if DRY_RUN else "COMPLETE"
    logger.info(
        "Migration %s: %d image(s) converted, ~%.1f KB (~%.1f MB) reclaimed.",
        mode,
        total_converted,
        total_saved / 1024,
        total_saved / (1024 * 1024),
    )


if __name__ == "__main__":
    asyncio.run(main())
