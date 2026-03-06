"""
Assessment Admin Router - Ported from Assessment-Portal-1/backend/main.py.
Handles administrative tasks like user management and system-wide analytics.
"""
import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from middleware.auth_middleware import get_current_user, TokenData, require_admin
from utils.assessment_db import (
    get_all_users, get_user_by_id, delete_user, get_results_by_user,
    get_assessment, get_all_assessments, get_all_results, upsert_user_from_token
)

logger = logging.getLogger("chrms.assessment.admin")

router = APIRouter()

@router.get("/users")
def admin_get_users(current_user: TokenData = Depends(require_admin)):
    users = get_all_users()
    formatted = [
        {"id": u["id"], "name": u["name"], "email": u["email"],
         "role": u["role"], "created_at": u.get("created_at").isoformat() if hasattr(u.get("created_at"), "isoformat") else str(u.get("created_at"))}
        for u in users
    ]
    return {"users": formatted}

@router.delete("/users")
async def admin_delete_user(request: Request, current_user: TokenData = Depends(require_admin)):
    body = await request.json()
    user_id = body.get("user_id")

    if not user_id:
        raise HTTPException(400, "user_id is required")

    user_to_delete = get_user_by_id(user_id)
    if not user_to_delete:
        raise HTTPException(404, "User not found")

    delete_user(user_id)
    role = user_to_delete["role"]
    return {
        "message": f"{role[0].upper()}{role[1:]} deleted successfully",
        "deleted_user": {
            "id": user_to_delete["id"],
            "name": user_to_delete["name"],
            "email": user_to_delete["email"],
            "role": role,
        },
    }

@router.get("/users/{user_id}/results")
def admin_user_results(user_id: str, current_user: TokenData = Depends(require_admin)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")

    results = get_results_by_user(user_id)
    formatted = []
    for r in results:
        assessment = get_assessment(r["assessment_id"])
        res = r["result"]
        formatted.append({
            "id": r["id"],
            "assessment_id": r["assessment_id"],
            "assessment_title": assessment["title"] if assessment else "Unknown Assessment",
            "max_score": res.get("max_score", 100),
            "score": res.get("score", 0),
            "percentage": round((res.get("score", 0) / max(res.get("max_score", 100), 1)) * 100),
            "graded_at": res.get("graded_at"),
            "timestamp": r["timestamp"].isoformat() if hasattr(r["timestamp"], "isoformat") else str(r["timestamp"])
        })

    return {
        "user": {"id": user["id"], "name": user["name"],
                 "email": user["email"], "role": user["role"]},
        "results": formatted,
    }

@router.get("/assessments")
def admin_get_assessments(current_user: TokenData = Depends(require_admin)):
    assessments = get_all_assessments()
    formatted = []
    for a in assessments:
        qs = a.get("questions", [])
        formatted.append({
            "id": a["assessment_id"],
            "assessment_id": a["assessment_id"],
            "title": a["title"],
            "description": a.get("description"),
            "difficulty": a.get("difficulty"),
            "created_at": a.get("created_at").isoformat() if hasattr(a.get("created_at"), "isoformat") else str(a.get("created_at")),
            "assigned_to": a.get("assigned_to", []),
            "duration_minutes": a.get("duration_minutes"),
            "questions_count": len(qs) if isinstance(qs, list) else 0,
        })
    return {"assessments": formatted}

@router.get("/analytics")
def admin_analytics(current_user: TokenData = Depends(require_admin)):
    all_results = get_all_results()

    groups: dict[str, list] = {}
    for r in all_results:
        aid = r["assessment_id"]
        groups.setdefault(aid, []).append(r)

    analytics = []
    for aid, results in groups.items():
        scores = [r["result"].get("score", 0) for r in results]
        times = [r["result"].get("analytics", {}).get("time_taken_seconds", 0) for r in results]
        avg_tpq = [r["result"].get("analytics", {}).get("avg_time_per_question_seconds", 0) for r in results]

        unique = len(set(r["user_id"] for r in results))
        avg = lambda arr: sum(arr) / len(arr) if arr else 0
        sorted_scores = sorted(scores)

        analytics.append({
            "assessment_id": aid,
            "admin_analytics": {
                "total_attempts": len(results),
                "unique_users_attempted": unique,
                "avg_time_per_question_seconds": avg(avg_tpq),
                "avg_total_time_seconds": avg(times),
                "score_distribution": {
                    "min": sorted_scores[0] if sorted_scores else 0,
                    "max": sorted_scores[-1] if sorted_scores else 0,
                    "mean": avg(scores),
                    "median": sorted_scores[len(sorted_scores) // 2] if sorted_scores else 0,
                },
            },
        })
    return analytics
