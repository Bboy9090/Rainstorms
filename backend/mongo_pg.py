"""
MongoDB-compatible async adapter over Replit's built-in PostgreSQL.

Implements the Motor/PyMongo subset used by server.py so the app works
with zero MongoDB dependency when MONGO_URL is not a valid Atlas URL.

All documents are stored in a single `documents` table as JSONB.
"""

import asyncpg
import json
import os
import re
from typing import Any, Dict, List, Optional


# ── helpers ──────────────────────────────────────────────────────────────────

def _default(obj):
    """JSON serialiser for non-serialisable types."""
    try:
        return str(obj)
    except Exception:
        return None


def _dumps(doc):
    return json.dumps(doc, default=_default)


def _match(doc: dict, filter_dict: dict) -> bool:
    """Recursively test whether doc satisfies a MongoDB-style filter."""
    if not filter_dict:
        return True
    for key, val in filter_dict.items():
        if key == '_id':
            continue
        if key == '$or':
            if not any(_match(doc, sub) for sub in val):
                return False
            continue
        if key == '$and':
            if not all(_match(doc, sub) for sub in val):
                return False
            continue

        # Nested key support: "a.b" → doc["a"]["b"]
        parts = key.split('.')
        doc_val = doc
        try:
            for p in parts:
                doc_val = doc_val[p]
        except (KeyError, TypeError):
            doc_val = None

        if isinstance(val, dict) and any(k.startswith('$') for k in val):
            for op, op_val in val.items():
                if op == '$eq':
                    if doc_val != op_val:
                        return False
                elif op == '$ne':
                    if doc_val == op_val:
                        return False
                elif op == '$in':
                    if doc_val not in op_val:
                        return False
                elif op == '$nin':
                    if doc_val in op_val:
                        return False
                elif op == '$gt':
                    if doc_val is None or doc_val <= op_val:
                        return False
                elif op == '$gte':
                    if doc_val is None or doc_val < op_val:
                        return False
                elif op == '$lt':
                    if doc_val is None or doc_val >= op_val:
                        return False
                elif op == '$lte':
                    if doc_val is None or doc_val > op_val:
                        return False
                elif op == '$exists':
                    field_exists = doc_val is not None
                    if bool(op_val) != field_exists:
                        return False
                elif op == '$regex':
                    flags = 0
                    if val.get('$options', '').find('i') >= 0:
                        flags = re.IGNORECASE
                    if not (isinstance(doc_val, str) and re.search(op_val, doc_val, flags)):
                        return False
                elif op == '$elemMatch':
                    if not isinstance(doc_val, list):
                        return False
                    if not any(_match(item if isinstance(item, dict) else {}, op_val) for item in doc_val):
                        return False
                # Unknown ops: ignore
        else:
            if doc_val != val:
                return False
    return True


def _apply_update(doc: dict, update_dict: dict) -> dict:
    """Apply a MongoDB update document ({$set, $push, $pull, $inc, ...}) to doc."""
    if '$set' in update_dict:
        for k, v in update_dict['$set'].items():
            # Support nested dot-notation writes
            parts = k.split('.')
            target = doc
            for p in parts[:-1]:
                target = target.setdefault(p, {})
            target[parts[-1]] = v

    if '$unset' in update_dict:
        for k in update_dict['$unset']:
            doc.pop(k, None)

    if '$push' in update_dict:
        for k, v in update_dict['$push'].items():
            if isinstance(v, dict) and '$each' in v:
                doc.setdefault(k, []).extend(v['$each'])
            else:
                doc.setdefault(k, []).append(v)

    if '$pull' in update_dict:
        for k, v in update_dict['$pull'].items():
            if isinstance(doc.get(k), list):
                doc[k] = [item for item in doc[k] if not _match(
                    item if isinstance(item, dict) else {'_v': item},
                    v if isinstance(v, dict) else {'_v': v}
                )]

    if '$addToSet' in update_dict:
        for k, v in update_dict['$addToSet'].items():
            lst = doc.setdefault(k, [])
            if v not in lst:
                lst.append(v)

    if '$inc' in update_dict:
        for k, v in update_dict['$inc'].items():
            doc[k] = doc.get(k, 0) + v

    return doc


# ── cursor ───────────────────────────────────────────────────────────────────

class _Cursor:
    """Lazy cursor that holds a list of already-fetched docs."""

    def __init__(self, docs: List[dict]):
        self._docs = docs
        self._sort_key = None
        self._sort_dir = 1
        self._skip_n = 0
        self._limit_n = None

    def sort(self, key_or_list, direction=None):
        if isinstance(key_or_list, list):
            if key_or_list:
                self._sort_key = key_or_list[0][0]
                self._sort_dir = key_or_list[0][1]
        else:
            self._sort_key = key_or_list
            self._sort_dir = direction if direction is not None else 1
        return self

    def skip(self, n):
        self._skip_n = n
        return self

    def limit(self, n):
        self._limit_n = n
        return self

    async def to_list(self, length=None):
        docs = list(self._docs)
        if self._sort_key:
            sk = self._sort_key
            reverse = self._sort_dir == -1
            docs.sort(
                key=lambda d: (d.get(sk) is None, d.get(sk, '')),
                reverse=reverse,
            )
        if self._skip_n:
            docs = docs[self._skip_n:]
        if self._limit_n is not None:
            docs = docs[:self._limit_n]
        if length is not None:
            docs = docs[:length]
        return docs

    def __aiter__(self):
        return self._aiter()

    async def _aiter(self):
        for doc in await self.to_list():
            yield doc


# ── collection ───────────────────────────────────────────────────────────────

class AsyncCollection:
    def __init__(self, pool: asyncpg.Pool, name: str):
        self._pool = pool
        self._name = name

    async def _all(self) -> List[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                'SELECT data FROM documents WHERE collection=$1', self._name
            )
        return [json.loads(r['data']) for r in rows]

    async def find_one(self, filter_dict=None):
        docs = await self._all()
        for doc in docs:
            if _match(doc, filter_dict or {}):
                return doc
        return None

    def find(self, filter_dict=None):
        return _LazyFind(self, filter_dict)

    async def insert_one(self, doc: dict):
        doc_id = doc.get('id') or doc.get('_id') or str(id(doc))
        async with self._pool.acquire() as conn:
            await conn.execute(
                '''INSERT INTO documents (collection, doc_id, data)
                   VALUES ($1, $2, $3::jsonb)
                   ON CONFLICT (collection, doc_id)
                   DO UPDATE SET data = $3::jsonb, updated_at = NOW()''',
                self._name, str(doc_id), _dumps(doc),
            )
        return type('InsertResult', (), {'inserted_id': doc_id})()

    async def insert_many(self, docs: List[dict]):
        for doc in docs:
            await self.insert_one(doc)

    async def update_one(self, filter_dict: dict, update_dict: dict, upsert=False):
        docs = await self._all()
        for doc in docs:
            if _match(doc, filter_dict):
                _apply_update(doc, update_dict)
                doc_id = str(doc.get('id') or doc.get('_id') or id(doc))
                async with self._pool.acquire() as conn:
                    await conn.execute(
                        'UPDATE documents SET data=$1::jsonb, updated_at=NOW() '
                        'WHERE collection=$2 AND doc_id=$3',
                        _dumps(doc), self._name, doc_id,
                    )
                return
        if upsert:
            new_doc = {}
            if '$setOnInsert' in update_dict:
                new_doc.update(update_dict['$setOnInsert'])
            _apply_update(new_doc, update_dict)
            await self.insert_one(new_doc)

    async def update_many(self, filter_dict: dict, update_dict: dict):
        docs = await self._all()
        for doc in docs:
            if _match(doc, filter_dict):
                _apply_update(doc, update_dict)
                doc_id = str(doc.get('id') or doc.get('_id') or id(doc))
                async with self._pool.acquire() as conn:
                    await conn.execute(
                        'UPDATE documents SET data=$1::jsonb, updated_at=NOW() '
                        'WHERE collection=$2 AND doc_id=$3',
                        _dumps(doc), self._name, doc_id,
                    )

    async def replace_one(self, filter_dict: dict, replacement: dict, upsert=False):
        docs = await self._all()
        for doc in docs:
            if _match(doc, filter_dict):
                doc_id = str(doc.get('id') or doc.get('_id') or id(doc))
                async with self._pool.acquire() as conn:
                    await conn.execute(
                        'UPDATE documents SET data=$1::jsonb, updated_at=NOW() '
                        'WHERE collection=$2 AND doc_id=$3',
                        _dumps(replacement), self._name, doc_id,
                    )
                return
        if upsert:
            await self.insert_one(replacement)

    async def delete_one(self, filter_dict: dict):
        docs = await self._all()
        for doc in docs:
            if _match(doc, filter_dict):
                doc_id = str(doc.get('id') or doc.get('_id') or id(doc))
                async with self._pool.acquire() as conn:
                    await conn.execute(
                        'DELETE FROM documents WHERE collection=$1 AND doc_id=$2',
                        self._name, doc_id,
                    )
                return

    async def delete_many(self, filter_dict: dict):
        docs = await self._all()
        for doc in docs:
            if _match(doc, filter_dict):
                doc_id = str(doc.get('id') or doc.get('_id') or id(doc))
                async with self._pool.acquire() as conn:
                    await conn.execute(
                        'DELETE FROM documents WHERE collection=$1 AND doc_id=$2',
                        self._name, doc_id,
                    )

    async def count_documents(self, filter_dict=None):
        docs = await self._all()
        if not filter_dict:
            return len(docs)
        return sum(1 for d in docs if _match(d, filter_dict))

    async def distinct(self, field: str, filter_dict=None):
        docs = await self._all()
        if filter_dict:
            docs = [d for d in docs if _match(d, filter_dict)]
        seen = set()
        result = []
        for doc in docs:
            val = doc.get(field)
            if val is None:
                continue
            if isinstance(val, list):
                for item in val:
                    key = str(item)
                    if key not in seen:
                        seen.add(key)
                        result.append(item)
            else:
                key = str(val)
                if key not in seen:
                    seen.add(key)
                    result.append(val)
        return result

    async def aggregate(self, pipeline: list):
        docs = await self._all()
        for stage in pipeline:
            if '$match' in stage:
                docs = [d for d in docs if _match(d, stage['$match'])]

            elif '$sort' in stage:
                for k, v in reversed(list(stage['$sort'].items())):
                    docs.sort(
                        key=lambda d, _k=k: (d.get(_k) is None, d.get(_k, '')),
                        reverse=(v == -1),
                    )

            elif '$limit' in stage:
                docs = docs[:stage['$limit']]

            elif '$skip' in stage:
                docs = docs[stage['$skip']:]

            elif '$project' in stage:
                proj = stage['$project']
                include = {k for k, v in proj.items() if v and k != '_id'}
                exclude = {k for k, v in proj.items() if not v}
                if include:
                    docs = [{k: d[k] for k in include if k in d} for d in docs]
                elif exclude:
                    docs = [{k: v for k, v in d.items() if k not in exclude} for d in docs]

            elif '$group' in stage:
                group_cfg = stage['$group']
                group_id_expr = group_cfg['_id']
                groups: Dict[str, dict] = {}

                for doc in docs:
                    if isinstance(group_id_expr, str) and group_id_expr.startswith('$'):
                        gid = doc.get(group_id_expr[1:])
                    elif group_id_expr is None:
                        gid = None
                    else:
                        gid = str(group_id_expr)

                    gid_key = str(gid)
                    if gid_key not in groups:
                        groups[gid_key] = {'_id': gid}

                    for out_k, expr in group_cfg.items():
                        if out_k == '_id':
                            continue
                        if '$sum' in expr:
                            field_expr = expr['$sum']
                            if isinstance(field_expr, str) and field_expr.startswith('$'):
                                val = doc.get(field_expr[1:], 0) or 0
                            else:
                                val = field_expr
                            groups[gid_key][out_k] = groups[gid_key].get(out_k, 0) + val
                        elif '$push' in expr:
                            field_expr = expr['$push']
                            if isinstance(field_expr, str) and field_expr.startswith('$'):
                                val = doc.get(field_expr[1:])
                            else:
                                val = field_expr
                            groups[gid_key].setdefault(out_k, []).append(val)
                        elif '$first' in expr:
                            field_expr = expr['$first']
                            if isinstance(field_expr, str) and field_expr.startswith('$'):
                                val = doc.get(field_expr[1:])
                            else:
                                val = field_expr
                            if out_k not in groups[gid_key]:
                                groups[gid_key][out_k] = val
                        elif '$last' in expr:
                            field_expr = expr['$last']
                            if isinstance(field_expr, str) and field_expr.startswith('$'):
                                val = doc.get(field_expr[1:])
                            else:
                                val = field_expr
                            groups[gid_key][out_k] = val

                docs = list(groups.values())

            elif '$unwind' in stage:
                field = stage['$unwind'].lstrip('$') if isinstance(stage['$unwind'], str) else stage['$unwind'].get('path', '').lstrip('$')
                new_docs = []
                for doc in docs:
                    items = doc.get(field, [])
                    if isinstance(items, list):
                        for item in items:
                            new_doc = dict(doc)
                            new_doc[field] = item
                            new_docs.append(new_doc)
                    else:
                        new_docs.append(doc)
                docs = new_docs

            elif '$addFields' in stage or '$set' in stage:
                adds = stage.get('$addFields') or stage.get('$set', {})
                for doc in docs:
                    for k, expr in adds.items():
                        if isinstance(expr, str) and expr.startswith('$'):
                            doc[k] = doc.get(expr[1:])
                        else:
                            doc[k] = expr

        return docs


class _LazyFind:
    """Deferred find — fetches and filters only when to_list() is called."""

    def __init__(self, col: AsyncCollection, filter_dict):
        self._col = col
        self._filter = filter_dict
        self._sort_key = None
        self._sort_dir = 1
        self._skip_n = 0
        self._limit_n = None

    def sort(self, key_or_list, direction=None):
        if isinstance(key_or_list, list):
            if key_or_list:
                self._sort_key = key_or_list[0][0]
                self._sort_dir = key_or_list[0][1]
        else:
            self._sort_key = key_or_list
            self._sort_dir = direction if direction is not None else 1
        return self

    def limit(self, n):
        self._limit_n = n
        return self

    def skip(self, n):
        self._skip_n = n
        return self

    async def to_list(self, length=None):
        docs = await self._col._all()
        if self._filter:
            docs = [d for d in docs if _match(d, self._filter)]
        if self._sort_key:
            sk = self._sort_key
            reverse = self._sort_dir == -1
            docs.sort(
                key=lambda d: (d.get(sk) is None, d.get(sk, '')),
                reverse=reverse,
            )
        if self._skip_n:
            docs = docs[self._skip_n:]
        if self._limit_n is not None:
            docs = docs[:self._limit_n]
        if length is not None:
            docs = docs[:length]
        return docs

    def __aiter__(self):
        return self._aiter()

    async def _aiter(self):
        for doc in await self.to_list():
            yield doc


# ── database ─────────────────────────────────────────────────────────────────

class AsyncDatabase:
    """Mimics a Motor AsyncIOMotorDatabase."""

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    def __getattr__(self, name: str) -> AsyncCollection:
        if name.startswith('_'):
            raise AttributeError(name)
        return AsyncCollection(self._pool, name)

    def __getitem__(self, name: str) -> AsyncCollection:
        return AsyncCollection(self._pool, name)

    async def list_collection_names(self):
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                'SELECT DISTINCT collection FROM documents ORDER BY collection'
            )
        return [r['collection'] for r in rows]


# ── factory ──────────────────────────────────────────────────────────────────

async def create_pg_db() -> AsyncDatabase:
    """Connect to Replit PostgreSQL and return a MongoDB-compatible database."""
    dsn = os.environ.get('DATABASE_URL', '')
    if dsn:
        # Replit provides DATABASE_URL — use it directly, no SSL override needed
        pool = await asyncpg.create_pool(dsn, min_size=1, max_size=10)
    else:
        pool = await asyncpg.create_pool(
            host=os.environ.get('PGHOST'),
            port=int(os.environ.get('PGPORT', 5432)),
            database=os.environ.get('PGDATABASE'),
            user=os.environ.get('PGUSER'),
            password=os.environ.get('PGPASSWORD'),
            min_size=1,
            max_size=10,
        )
    async with pool.acquire() as conn:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS documents (
                collection  TEXT         NOT NULL,
                doc_id      TEXT         NOT NULL,
                data        JSONB        NOT NULL,
                created_at  TIMESTAMPTZ  DEFAULT NOW(),
                updated_at  TIMESTAMPTZ  DEFAULT NOW(),
                PRIMARY KEY (collection, doc_id)
            )
        ''')
        await conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_docs_col ON documents(collection)'
        )
    return AsyncDatabase(pool)
