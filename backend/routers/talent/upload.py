"""
routes/upload.py
POST /api/upload
"""
import os
import time
import random
import string
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()

# Save resumes next to the React public/ directory
UPLOAD_DIR = Path(__file__).parent.parent.parent / "frontend" / "public" / "uploads" / "resumes"


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(400, "No file uploaded")

    try:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

        # Safe filename: strip non-alphanumeric characters
        safe_name = "".join(c for c in (file.filename or "file") if c.isalnum() or c in ".-_")
        unique_suffix = f"{int(time.time() * 1000)}-{random.randint(100000000, 999999999)}"
        filename = f"{unique_suffix}-{safe_name}"

        filepath = UPLOAD_DIR / filename
        content = await file.read()
        filepath.write_bytes(content)

        url = f"/uploads/resumes/{filename}"
        return JSONResponse(content={"url": url})
    except Exception as exc:
        print(f"Upload error: {exc}")
        raise HTTPException(500, "Error uploading file")
