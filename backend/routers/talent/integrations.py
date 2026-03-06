"""
routes/integrations.py
GET /api/integrations/applicants
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

import guhatek_api as gapi

router = APIRouter()


@router.get("/integrations/applicants")
async def get_external_applicants():
    try:
        applications = await gapi.get_applications()
        return JSONResponse(content=applications)
    except Exception as exc:
        print(f"API Integration Error: {exc}")
        raise HTTPException(500, f"Failed to fetch external applications: {exc}")
