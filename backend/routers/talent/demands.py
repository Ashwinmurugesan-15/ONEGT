"""
routes/demands.py
GET   /api/demands
POST  /api/demands
PATCH /api/demands
DELETE /api/demands/{id}
PATCH /api/demands/update  (alias)
"""
import time
import logging
import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List, Any

from utils.talent_db import read_db, write_db
from utils.talent_cache import api_cache
import utils.recruitment_api as gapi
from utils.logging_utils import trace_exceptions_async
from middleware.auth_middleware import get_current_user, TokenData

logger = logging.getLogger("chrms.talent.demands")

router = APIRouter()

CACHE_KEY = "demands_list"


@router.get("/demands")
@trace_exceptions_async
async def get_demands(current_user: TokenData = Depends(get_current_user)):
    cached = api_cache.get(CACHE_KEY)
    if cached is not None:
        return JSONResponse(content=cached)
    try:
        demands = await gapi.get_job_openings()
        api_cache.set(CACHE_KEY, demands)
        return JSONResponse(content=demands)
    except Exception as exc:
        print(f"⚠️ API issue fetching demands, falling back to local DB: {exc}")
        db = await read_db()
        local = db.get("demands", [])
        api_cache.set(CACHE_KEY, local)
        return JSONResponse(content=local)


@router.post("/demands", status_code=201)
@trace_exceptions_async
async def add_demand(demand: dict, current_user: TokenData = Depends(get_current_user)):
    try:
        api_payload = {
            "jobTitle": demand.get("title", "Untitled"),
            "role": demand.get("role", ""),
            "experience": demand.get("experience", ""),
            "location": demand.get("location", ""),
            "numberOfOpenings": int(demand.get("openings", 1)),
            "requireSkill": demand.get("skills", []),
            # New enhanced fields
            "department": demand.get("department", "Software-Development"),
            "roleCategory": demand.get("roleCategory", ""),
            "level": demand.get("level", "Mid"),
            "employmentType": demand.get("employmentType", "Full-time"),
            "workMode": demand.get("workMode", "Onsite"),
            "salary": demand.get("salary", "N/A"),
            "description": demand.get("description", ""),
            "responsibilities": demand.get("responsibilities", []),
            "requirements": demand.get("requirements", demand.get("skills", [])),
            "niceToHave": demand.get("niceToHave", []),
            "businessImpact": demand.get("businessImpact", []),
            "isActive": demand.get("isActive", True),
            "postedDate": demand.get("postedDate", time.strftime("%Y-%m-%d"))
        }
        response = await gapi.create_demand(api_payload)
        
        if response.get("success"):
            api_cache.clear(CACHE_KEY)
            return JSONResponse(content={"id": response.get("id"), **demand}, status_code=201)

        if response.get("status") == 429:
            raise HTTPException(429, response.get("message") or "Too many requests to upstream API")

        raise HTTPException(400, response.get("message") or response.get("error") or "Failed to create demand")
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error creating demand: {exc}")
        raise HTTPException(500, "Failed to add demand")


@router.patch("/demands")
@trace_exceptions_async
async def update_demand(body: dict, current_user: TokenData = Depends(get_current_user)):
    demand_id = body.get("id")
    if not demand_id:
        raise HTTPException(400, "Demand ID is required")
    rest = {k: v for k, v in body.items() if k != "id"}

    # Build a clean payload for the upstream API
    api_payload: dict[str, Any] = {}
    if "title" in rest: api_payload["jobTitle"] = rest["title"]
    if "role" in rest: api_payload["role"] = rest["role"]
    if "experience" in rest: api_payload["experience"] = rest["experience"]
    if "location" in rest: api_payload["location"] = rest["location"]
    
    # Safely convert openings to int
    if "openings" in rest:
        try:
            api_payload["numberOfOpenings"] = int(rest["openings"])
        except (ValueError, TypeError):
            pass
            
    if "skills" in rest:
        api_payload["requireSkill"] = rest["skills"] if isinstance(rest["skills"], list) else []

    if "status" in rest: 
        status_val = str(rest["status"]).lower().replace("_", " ")
        if status_val == "closed":
            api_payload["jobStatus"] = "Closed"
            api_payload["isActive"] = False
        elif status_val == "on hold":
            api_payload["jobStatus"] = "On Hold"
            api_payload["isActive"] = True
        elif status_val == "deleted":
            api_payload["jobStatus"] = "Deleted"
            api_payload["isActive"] = False
        else:
            api_payload["jobStatus"] = "Open"
            api_payload["isActive"] = True

    # Map new fields if they exist in the update body
    for field in ["department", "roleCategory", "level", "employmentType", "workMode", 
                 "salary", "description", "responsibilities", "requirements", 
                 "niceToHave", "businessImpact", "isActive", "postedDate"]:
        if field in rest:
            api_payload[field] = rest[field]

    logger.info(f"Updating demand {demand_id} with api_payload: {api_payload}")
    try:
        # Avoid sending 'rest' directly as it contains non-updatable fields like 'createdAt'
        response = await gapi.update_demand(demand_id, api_payload if api_payload else {"jobStatus": "Open"})
        logger.info(f"Guhatek API update_demand response: {response}")
        if response.get("success"):
            api_cache.clear(CACHE_KEY)
            return {"id": demand_id, **(response.get("updated") or {})}

        if response.get("status") == 404:
            raise HTTPException(404, "Demand not found remotely")
        
        if response.get("status") == 429:
            raise HTTPException(429, response.get("message") or "Too many requests to upstream API")

        error_msg = response.get("message") or response.get("error") or "Failed to update demand"
        raise HTTPException(400, f"Upstream API Error: {error_msg}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Failed to update demand: {exc}")


@router.patch("/demands/update")
@trace_exceptions_async
async def update_demand_alias(body: dict, current_user: TokenData = Depends(get_current_user)):
    return await update_demand(body, current_user)


@router.delete("/demands/{demand_id}")
@trace_exceptions_async
async def delete_demand_route(demand_id: str, current_user: TokenData = Depends(get_current_user)):
    try:
        response = await gapi.delete_demand(demand_id)
        if response.get("success"):
            api_cache.clear(CACHE_KEY)
            return {"success": True, "message": "Demand deleted successfully"}

        raise HTTPException(404, "Demand not found")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Failed to delete demand: {exc}")
