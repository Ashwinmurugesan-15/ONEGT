"""
db.py – Async read/write for db.json (mirrors src/lib/db.ts)
"""
import json
import asyncio
import os
from pathlib import Path

# Path relative to project root (two levels up from utils/ inside backend/)
DB_PATH = Path(__file__).parent.parent.parent / "frontend" / "src" / "modules" / "talent" / "data" / "db.json"

_lock = None

def get_lock():
    global _lock
    if _lock is None:
        _lock = asyncio.Lock()
    return _lock

async def read_db() -> dict:
    async with get_lock():
        if not DB_PATH.exists():
            # In some read-only environments, the local JSON file may not be present.
            # Return an empty structure so callers can still work with external API data.
            return {"candidates": [], "interviews": [], "demands": []}
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)


async def write_db(data: dict) -> None:
    async with get_lock():
        if not DB_PATH.exists():
            # Cannot persist locally if file doesn't exist – silently skip.
            return
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

