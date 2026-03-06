"""
routes/interviews.py
GET   /api/interviews
POST  /api/interviews
PATCH /api/interviews
"""
import logging
import time
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List

from utils.talent_db import read_db, write_db
from utils.talent_cache import api_cache
import utils.recruitment_api as gapi
from utils.logging_utils import trace_exceptions_async
from middleware.auth_middleware import get_current_user, TokenData

logger = logging.getLogger("chrms.talent.interviews")

router = APIRouter()

CACHE_KEY = "interviews_list"


@router.get("/interviews")
@trace_exceptions_async
async def get_interviews(current_user: TokenData = Depends(get_current_user)):
    cached = api_cache.get(CACHE_KEY)
    if cached is not None:
        return JSONResponse(content=cached)
    try:
        interviews = await gapi.get_scheduled_meetings()
        api_cache.set(CACHE_KEY, interviews)
        return JSONResponse(content=interviews)
    except Exception as exc:
        print(f"⚠️ API issue, falling back to local DB for interviews: {exc}")
        db = await read_db()
        local = db.get("interviews", [])
        api_cache.set(CACHE_KEY, local)
        return JSONResponse(content=local)


@router.post("/interviews", status_code=201)
@trace_exceptions_async
async def add_interview(interview: dict, current_user: TokenData = Depends(get_current_user)):
    try:
        from datetime import datetime
        dt_str = interview.get("scheduledAt", "")
        i_date, i_time = "", ""
        if dt_str:
            try:
                if "T" in dt_str:
                    parts = dt_str.split("T")
                    i_date = parts[0]
                    i_time = parts[1][:5]
                else:
                    i_date = dt_str
            except Exception:
                pass

        api_payload = {
            "position": interview.get("demandTitle", "Unknown Position"),
            "interviewRound": interview.get("round", "Round 1"),
            "interviewDate": i_date,
            "interviewTime": i_time,
            "interviewerName": interview.get("interviewerName", "Interviewer"),
            "meetLink": interview.get("meetLink", ""),
            "candidateId": interview.get("candidateId", ""),
            "candidateName": interview.get("candidateName", "")
        }
        
        response = await gapi.schedule_meet(api_payload)
        if response.get("success"):
            api_cache.clear(CACHE_KEY)
            return JSONResponse(content={"id": response.get("id"), **interview}, status_code=201)

        if response.get("status") == 404:
            raise HTTPException(404, "Endpoint not found on upstream API")

        raise HTTPException(400, response.get("message") or response.get("error") or "Failed to schedule interview")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Failed to add interview: {exc}")


@router.patch("/interviews")
@trace_exceptions_async
async def update_interview(interview: dict, current_user: TokenData = Depends(get_current_user)):
    interview_id = interview.get("id")
    if not interview_id:
        raise HTTPException(400, "Interview ID is required")
    rest = {k: v for k, v in interview.items() if k != "id"}

    api_payload = {}
    if "demandTitle" in rest: api_payload["position"] = rest["demandTitle"]
    if "round" in rest: api_payload["interviewRound"] = rest["round"]
    if "interviewerName" in rest: api_payload["interviewerName"] = rest["interviewerName"]
    if "meetLink" in rest: api_payload["meetLink"] = rest["meetLink"]
    
    if "scheduledAt" in rest:
        dt_str = rest["scheduledAt"]
        try:
            if dt_str and "T" in dt_str:
                parts = dt_str.split("T")
                api_payload["interviewDate"] = parts[0]
                api_payload["interviewTime"] = parts[1][:5]
            elif dt_str:
                api_payload["interviewDate"] = dt_str
        except Exception:
            pass

    try:
        if not api_payload:
            # If we are only updating fields like 'status' or 'feedback' which are 
            # handled by the frontend/candidate context, we don't need to call Guhatek
            if rest.get("status") or rest.get("feedback"):
                return {"id": interview_id, "status": rest.get("status", "scheduled"), "message": "Local status update successful"}
            
        response = await gapi.update_meet(interview_id, api_payload if api_payload else rest)
        if response.get("success"):
            api_cache.clear(CACHE_KEY)
            return {"id": interview_id, **(response.get("updated") or {})}

        if response.get("status") == 404:
            raise HTTPException(404, "Interview not found on upstream API")

        error_msg = response.get("message") or response.get("error") or "Failed to update interview"
        raise HTTPException(400, f"Upstream API Error: {error_msg}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Failed to update interview: {exc}")
