"""
Assessment Learning Router - Ported from Assessment-Portal-1/backend/main.py.
Handles learning resources, progress tracking, and viewing analytics.
"""
import re
import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from middleware.auth_middleware import get_current_user, TokenData, require_manager_or_admin
from utils.assessment_db import (
    get_all_learning_resources, get_learning_resource, create_learning_resource,
    update_learning_resource, delete_learning_resource, save_learning_progress,
    get_user_learning_progress, get_resource_view_analytics, upsert_user_from_token,
    _gen_id, _serialise
)

logger = logging.getLogger("chrms.assessment.learning")

router = APIRouter()

def _determine_url_type(url: str) -> str:
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/)([^&\n?#]+)",
        r"youtube\.com/embed/([^&\n?#]+)",
        r"youtube\.com/v/([^&\n?#]+)",
    ]
    for p in patterns:
        if re.search(p, url):
            return "youtube"
    return "generic"

@router.get("/")
@router.get("")
def get_learning_resources(current_user: TokenData = Depends(get_current_user)):
    logger.info(f"Fetching learning resources for user {current_user.associate_id}")
    upsert_user_from_token(current_user)
    resources = get_all_learning_resources()
    safe = [{k: _serialise(v) for k, v in r.items()} for r in resources]
    return {"resources": safe}

@router.post("", status_code=201)
async def create_learning_resource_route(
    request: Request, 
    current_user: TokenData = Depends(require_manager_or_admin)
):
    upsert_user_from_token(current_user)
    body = await request.json()
    title = body.get("title")
    description = body.get("description")
    course_url = body.get("course_url")
    image_url = body.get("image_url")

    if not title or not description or not course_url:
        raise HTTPException(400, "Missing required fields")

    url_type = _determine_url_type(course_url)

    resource = create_learning_resource({
        "id": _gen_id(),
        "title": title,
        "description": description,
        "course_url": course_url,
        "url_type": url_type,
        "image_url": image_url,
        "created_by": current_user.associate_id,
    })
    safe = {k: _serialise(v) for k, v in resource.items()}
    return {"resource": safe}

@router.get("/{resource_id}")
def get_learning_resource_route(
    resource_id: str, 
    current_user: TokenData = Depends(get_current_user)
):
    upsert_user_from_token(current_user)
    resource = get_learning_resource(resource_id)
    if not resource:
        raise HTTPException(404, "Learning resource not found")
    safe = {k: _serialise(v) for k, v in resource.items()}
    return {"resource": safe}

@router.put("/{resource_id}")
async def update_learning_resource_route(
    resource_id: str, 
    request: Request,
    current_user: TokenData = Depends(require_manager_or_admin)
):
    upsert_user_from_token(current_user)
    body = await request.json()

    updates: dict = {}
    for key in ("title", "description", "image_url"):
        if body.get(key) is not None:
            updates[key] = body[key]
    if body.get("course_url") is not None:
        updates["course_url"] = body["course_url"]
        updates["url_type"] = _determine_url_type(body["course_url"])

    resource = update_learning_resource(resource_id, updates)
    if not resource:
        raise HTTPException(404, "Learning resource not found")
    safe = {k: _serialise(v) for k, v in resource.items()}
    return {"resource": safe}

@router.delete("/{resource_id}")
def delete_learning_resource_route(
    resource_id: str, 
    current_user: TokenData = Depends(require_manager_or_admin)
):
    upsert_user_from_token(current_user)
    delete_learning_resource(resource_id)
    return {"message": "Learning resource deleted successfully"}

@router.post("/{resource_id}/view")
def record_resource_view(
    resource_id: str, 
    current_user: TokenData = Depends(get_current_user)
):
    upsert_user_from_token(current_user)
    save_learning_progress(current_user.associate_id, resource_id)
    return {"success": True}

@router.get("/{resource_id}/analytics")
def get_resource_analytics(
    resource_id: str, 
    current_user: TokenData = Depends(require_manager_or_admin)
):
    upsert_user_from_token(current_user)
    analytics = get_resource_view_analytics(resource_id)
    safe = [{k: _serialise(v) for k, v in r.items()} for r in analytics]
    return {"analytics": safe}
