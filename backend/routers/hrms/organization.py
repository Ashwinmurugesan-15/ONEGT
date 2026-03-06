import logging
import traceback
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from services.google_sheets import sheets_service
from models.hrms.organization import (
    Department, DataRole, WorkLocation,
    row_to_department, row_to_role, row_to_work_location
)
from config import settings
from middleware.auth_middleware import get_current_user

logger = logging.getLogger("chrms.organization")

router = APIRouter()

@router.get("/departments", response_model=List[Department])
async def get_departments(current_user: dict = Depends(get_current_user)):
    """Get all departments."""
    try:
        records = sheets_service.get_all_records(settings.DEPARTMENTS_SHEET)
        # Handle both "Department ID" and "Department Id"
        departments = [row_to_department(r) for r in records if r.get("Department ID") or r.get("Department Id")]
        return departments
    except Exception as e:
        logger.error(f"Error fetching departments: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/roles", response_model=List[DataRole])
async def get_roles(current_user: dict = Depends(get_current_user)):
    """Get all job roles (designations)."""
    try:
        records = sheets_service.get_all_records(settings.DESIGNATIONS_SHEET)
        # Handle both "Role ID" and "Role Id"
        roles = [row_to_role(r) for r in records if r.get("Role ID") or r.get("Role Id")]
        return roles
    except Exception as e:
        logger.error(f"Error fetching roles: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/work-locations", response_model=List[WorkLocation])
async def get_work_locations(current_user: dict = Depends(get_current_user)):
    """Get all work locations."""
    try:
        records = sheets_service.get_all_records(settings.WORK_LOCATIONS_SHEET)
        locations = [row_to_work_location(r) for r in records if r.get("Work Location Id") or r.get("Work Location ID") or r.get("Name")]
        return locations
    except Exception as e:
        logger.error(f"Error fetching work locations: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
