"""
Assessment Examiner Router - Ported from Assessment-Portal-1/backend/main.py.
Handles examiner-specific endpoints for managing assessments and viewing candidate results.
"""
import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from middleware.auth_middleware import get_current_user, TokenData, require_manager_or_admin
from utils.assessment_db import (
    get_assessments_by_examiner, get_all_results, get_assessment,
    get_user_by_id, get_results, update_assessment, get_user_attempt_count,
    get_users_by_role, upsert_user_from_token, _serialise
)

logger = logging.getLogger("chrms.assessment.examiner")

router = APIRouter()

@router.get("/assessments")
def examiner_assessments(current_user: TokenData = Depends(require_manager_or_admin)):
    upsert_user_from_token(current_user)
    examiner_id = current_user.associate_id
    
    assessments = get_assessments_by_examiner(examiner_id)

    total_candidates = len(set(
        cid for a in assessments for cid in (a.get("assigned_to") or [])
    ))

    all_results = get_all_results()
    assessment_ids = {a.get("assessment_id") or a.get("id") for a in assessments}
    relevant = [r for r in all_results if r["assessment_id"] in assessment_ids]

    avg_score = 0
    if relevant:
        avg_score = sum(
            (r["result"].get("score", 0) / max(r["result"].get("max_score", 100), 1)) * 100
            for r in relevant
        ) / len(relevant)

    formatted = [{
        "id": a.get("assessment_id") or a.get("id"),
        "title": a["title"],
        "description": a.get("description"),
        "difficulty": a.get("difficulty"),
        "created_at": _serialise(a.get("created_at")),
        "assigned_to": a.get("assigned_to", []),
        "questions_count": len(a.get("questions", [])),
    } for a in assessments]

    return {"assessments": formatted, "totalCandidates": total_candidates, "avgScore": avg_score}

@router.get("/candidates")
async def examiner_candidates(current_user: TokenData = Depends(require_manager_or_admin)):
    # Pull candidates from Assessment DB users
    from utils.assessment_db import get_users_by_role
    local_candidates = get_users_by_role("candidate")
    
    candidate_list = [
        {"id": c["id"], "name": c["name"], "email": c["email"], "source": "assessment"}
        for c in local_candidates
    ]

    # Pull candidates from Recruitment API
    try:
        from utils.recruitment_api import get_applications
        apps = await get_applications()
        for app in apps:
            # Check if already in list
            if not any(c["id"] == app["id"] or c["email"] == app["email"] for c in candidate_list):
                candidate_list.append({
                    "id": app["id"], 
                    "name": app.get("full_name") or app.get("name") or "Unknown Candidate",
                    "email": app.get("email"),
                    "source": "recruitment"
                })
    except Exception as e:
        logger.warning(f"Failed to fetch candidates from recruitment API: {e}")

    return {"candidates": candidate_list}

@router.get("/assessment/{assessment_id}")
def examiner_assessment_detail(
    assessment_id: str, 
    current_user: TokenData = Depends(require_manager_or_admin)
):
    assessment = get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(404, "Assessment not found")

    results = get_results(assessment_id)
    safe_assessment = {k: _serialise(v) for k, v in assessment.items()}
    
    # Format results
    formatted_results = []
    for r in results:
        u = get_user_by_id(r["user_id"])
        res_data = r.get("result") or {}
        formatted_results.append({
            "user_id": r["user_id"],
            "user_name": u["name"] if u else f"Unknown ({r['user_id'][:8]})",
            "user_email": u["email"] if u else "N/A",
            "score": res_data.get("score", 0),
            "max_score": res_data.get("max_score", 100),
            "graded_at": res_data.get("graded_at") or _serialise(r.get("timestamp")),
            "retake_granted": r["user_id"] in (assessment.get("retake_permissions") or [])
        })

    # Get details of assigned users
    assigned_ids = assessment.get("assigned_to") or []
    assigned_users = []
    for uid in assigned_ids:
        u = get_user_by_id(uid)
        if u:
            assigned_users.append({"id": u["id"], "name": u["name"], "email": u["email"]})
        else:
            # Fallback if user not in assessment DB yet
            assigned_users.append({"id": uid, "name": "Pending Login", "email": "N/A"})

    return {
        "assessment": safe_assessment,
        "results": formatted_results,
        "assigned_users": assigned_users
    }

@router.patch("/assessment/{assessment_id}")
async def examiner_update_assignments(
    assessment_id: str, 
    request: Request,
    current_user: TokenData = Depends(require_manager_or_admin)
):
    body = await request.json()
    assigned_to = body.get("assigned_to")
    if not isinstance(assigned_to, list):
        raise HTTPException(400, "assigned_to must be an array")

    updated = update_assessment(assessment_id, {"assigned_to": assigned_to})
    if not updated:
        raise HTTPException(404, "Assessment not found")

    safe = {k: _serialise(v) for k, v in updated.items()}
    return {"message": "Assignments updated successfully", "assessment": safe}

@router.get("/assessment/{assessment_id}/result/{user_id}")
def examiner_candidate_result(
    assessment_id: str, 
    user_id: str,
    current_user: TokenData = Depends(require_manager_or_admin)
):
    assessment = get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(404, "Assessment not found")

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")

    all_results = get_results(assessment_id)
    user_results = sorted(
        [r for r in all_results if r["user_id"] == user_id],
        key=lambda r: r.get("timestamp", ""),
    )

    safe_assessment = {k: _serialise(v) for k, v in assessment.items()}
    safe_results = []
    for r in user_results:
        safe_results.append({k: _serialise(v) for k, v in r.items()})

    return {
        "assessment": safe_assessment,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"]},
        "results": safe_results,
    }

@router.post("/assessment/{assessment_id}/retake")
async def grant_retake(
    assessment_id: str, 
    request: Request,
    current_user: TokenData = Depends(require_manager_or_admin)
):
    body = await request.json()
    candidate_id = body.get("candidate_id")

    if not candidate_id:
        raise HTTPException(400, "candidate_id is required")

    assessment = get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(404, "Assessment not found")

    # Only creator or admin
    if assessment["created_by"] != current_user.associate_id and current_user.role != "Admin":
        raise HTTPException(403, "Only the creator or an admin can grant retake permissions")

    attempts = get_user_attempt_count(assessment_id, candidate_id)
    if attempts == 0:
        raise HTTPException(400, "Candidate has not attempted this assessment yet")

    perms = assessment.get("retake_permissions") or []
    if candidate_id in perms:
        return {"message": "Candidate already has retake permission"}

    update_assessment(assessment_id, {"retake_permissions": perms + [candidate_id]})
    return {"message": "Retake permission granted successfully",
            "candidate_id": candidate_id, "assessment_id": assessment_id}

@router.delete("/assessment/{assessment_id}/retake")
async def revoke_retake(
    assessment_id: str, 
    request: Request,
    current_user: TokenData = Depends(require_manager_or_admin)
):
    body = await request.json()
    candidate_id = body.get("candidate_id")

    if not candidate_id:
        raise HTTPException(400, "candidate_id is required")

    assessment = get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(404, "Assessment not found")

    if assessment["created_by"] != current_user.associate_id and current_user.role != "Admin":
        raise HTTPException(403, "Only the creator or an admin can revoke retake permissions")

    perms = assessment.get("retake_permissions") or []
    update_assessment(assessment_id, {
        "retake_permissions": [uid for uid in perms if uid != candidate_id]
    })
    return {"message": "Retake permission revoked successfully",
            "candidate_id": candidate_id, "assessment_id": assessment_id}
