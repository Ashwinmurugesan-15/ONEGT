"""
Assessment Candidate Router - Ported from Assessment-Portal-1/backend/main.py.
Handles candidate-specific endpoints for assessments and results.
"""
import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from middleware.auth_middleware import get_current_user, TokenData
from utils.assessment_db import (
    get_assessments_by_candidate, get_results_by_user, get_assessment, 
    upsert_user_from_token
)

logger = logging.getLogger("chrms.assessment.candidate")

router = APIRouter()

@router.get("/my-assessments")
def candidate_assessments(current_user: TokenData = Depends(get_current_user)):
    upsert_user_from_token(current_user)
    user_id = current_user.associate_id
    
    assessments = get_assessments_by_candidate(user_id)
    user_results = get_results_by_user(user_id)

    formatted = []
    for a in assessments:
        aid = a.get("assessment_id")
        has_result = any(r["assessment_id"] == aid for r in user_results)
        retake = user_id in (a.get("retake_permissions") or [])
        status = "completed" if has_result and not retake else "upcoming"
        formatted.append({
            "id": aid,
            "title": a["title"],
            "description": a.get("description"),
            "difficulty": a.get("difficulty"),
            "scheduled_for": a.get("scheduled_for").isoformat() if hasattr(a.get("scheduled_for"), "isoformat") else str(a.get("scheduled_for")),
            "scheduled_from": a.get("scheduled_from").isoformat() if hasattr(a.get("scheduled_from"), "isoformat") else str(a.get("scheduled_from")),
            "scheduled_to": a.get("scheduled_to").isoformat() if hasattr(a.get("scheduled_to"), "isoformat") else str(a.get("scheduled_to")),
            "duration_minutes": a.get("duration_minutes"),
            "status": status,
        })
    return {"assessments": formatted}

@router.get("/my-results")
def candidate_results(current_user: TokenData = Depends(get_current_user)):
    upsert_user_from_token(current_user)
    user_id = current_user.associate_id
    
    results = get_results_by_user(user_id)
    formatted = []
    for r in results:
        assessment = get_assessment(r["assessment_id"])
        res = r["result"]
        formatted.append({
            "assessment_id": r["assessment_id"],
            "assessment_title": assessment["title"] if assessment else "Unknown Assessment",
            "score": res.get("score", 0),
            "max_score": res.get("max_score", 100),
            "graded_at": res.get("graded_at"),
        })
    return {"results": formatted}
