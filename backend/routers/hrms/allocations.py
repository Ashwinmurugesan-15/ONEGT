from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
import logging
import traceback
from services.google_sheets import sheets_service
from models.hrms.allocation import (
    Allocation, AllocationCreate, AllocationUpdate,
    allocation_to_row, row_to_allocation
)
from config import settings
from datetime import datetime
from middleware.auth_middleware import get_current_user, TokenData
from services.email_service import email_service
from models.hrms.associate import row_to_associate

logger = logging.getLogger("chrms.allocations")

router = APIRouter()

def _get_master_lookups():
    """Helper to fetch and create lookup maps for master data."""
    projects_data = sheets_service.get_all_records(settings.PROJECTS_SHEET)
    associates_data = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
    
    project_map = {str(p.get("Project ID", "")).strip(): p.get("Project Name", "") for p in projects_data if p.get("Project ID")}
    associate_map = {str(a.get("Associate ID", "")).strip(): a.get("Associate Name", "") for a in associates_data if a.get("Associate ID")}
    
    return project_map, associate_map

@router.get("/dashboard-view")
async def get_allocations_dashboard(
    active_only: bool = True,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get allocations for the dashboard view.
    Returns:
    - my_allocations: Allocations where the current user is the Associate.
    - managed_allocations: Allocations for projects managed by the current user.
    Enriches data with names from Project and Associate masters.
    """
    try:
        # Fetch all necessary data
        allocations_data = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        projects_data = sheets_service.get_all_records(settings.PROJECTS_SHEET)
        associates_data = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)

        # Create lookup maps for enrichment
        # Ensure IDs are strings and stripped of whitespace for reliable matching
        project_map = {str(p.get("Project ID", "")).strip(): p.get("Project Name", "") for p in projects_data if p.get("Project ID")}
        project_status_map = {str(p.get("Project ID", "")).strip(): p.get("Status", "") for p in projects_data if p.get("Project ID")}
        associate_map = {str(a.get("Associate ID", "")).strip(): a.get("Associate Name", "") for a in associates_data if a.get("Associate ID")}
        
        # Identify projects managed by the current user
        managed_project_ids = set()
        user_role_lower = current_user.role.lower()
        if user_role_lower not in ["admin", "hr"]:
             for p in projects_data:
                if str(p.get("Project Manager ID", "")).strip() == current_user.associate_id:
                     managed_project_ids.add(str(p.get("Project ID", "")).strip())

        my_allocations = []
        managed_allocations = []

        is_full_access = user_role_lower in ["admin", "hr"]
        
        valid_statuses = ["active", "in progress"]

        for idx, r in enumerate(allocations_data):
            if not r.get("Project ID"):
                continue

            # Enrich the record with real names
            # Strip whitespace to match the map keys
            project_id = str(r.get("Project ID", "")).strip()
            associate_id = str(r.get("Associate ID", "")).strip()
            
            # Create a copy of the record to avoid modifying the cache/original if mutable
            enriched_record = r.copy()
            if project_id in project_map:
                enriched_record["Project Name"] = project_map[project_id]
            if project_status_map.get(project_id): # Use get to avoid key error if somehow missing but in project_map
                enriched_record["Project Status"] = project_status_map.get(project_id)
                
            if associate_id in associate_map:
                enriched_record["Associate Name"] = associate_map[associate_id]
            
            allocation_obj = row_to_allocation(enriched_record, idx + 2)
            
            project_status = allocation_obj.project_status.lower().strip()
            
            # Check for "My Allocation"
            # Filter: Show only if proj status is active/in progress OR active_only is False
            if associate_id == current_user.associate_id:
                if not active_only or project_status in valid_statuses:
                    my_allocations.append(allocation_obj)

            # Check for "Managed Allocations"
            # Filter: Show only if proj status is active/in progress OR active_only is False
            if not active_only or project_status in valid_statuses:
                if is_full_access:
                    managed_allocations.append(allocation_obj)
                elif project_id in managed_project_ids:
                    managed_allocations.append(allocation_obj)

        return {
            "my_allocations": my_allocations,
            "managed_allocations": managed_allocations
        }

    except Exception as e:
        logger.error(f"Error fetching dashboard allocations: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[Allocation])
async def get_allocations(
    project_id: Optional[str] = None,
    associate_id: Optional[str] = None,
    allocation_type: Optional[str] = None
):
    """Get all allocations with optional filters."""
    try:
        project_map, associate_map = _get_master_lookups()
        records = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        allocations = []
        
        for idx, r in enumerate(records):
            if not r.get("Project ID"):
                continue
            
            # Apply filters
            if project_id and r.get("Project ID") != project_id:
                continue
            if associate_id and r.get("Associate ID") != associate_id:
                continue
            if allocation_type and r.get("Allocation Type", "").lower() != allocation_type.lower():
                continue
            
            # Enrich with names
            pid = str(r.get("Project ID", "")).strip()
            aid = str(r.get("Associate ID", "")).strip()
            
            enriched_r = r.copy()
            if pid in project_map:
                enriched_r["Project Name"] = project_map[pid]
            if aid in associate_map:
                enriched_r["Associate Name"] = associate_map[aid]

            allocations.append(row_to_allocation(enriched_r, idx + 2))
        
        return allocations
    except Exception as e:
        error_msg = f"\n{'='*60}\nERROR in GET /api/allocations/\n{'='*60}\n"
        error_msg += f"Exception: {type(e).__name__}: {str(e)}\n"
        error_msg += f"Traceback:\n{traceback.format_exc()}\n{'='*60}\n"
        print(error_msg, flush=True)
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=dict)
async def create_allocation(allocation: AllocationCreate):
    """Create a new allocation."""
    try:
        row = allocation_to_row(allocation)
        result = sheets_service.append_row(settings.ALLOCATIONS_SHEET, row)
        
        # Trigger email notification
        try:
            # Get associate details
            assoc_record = sheets_service.get_row_by_id(settings.ASSOCIATES_SHEET, "Associate ID", allocation.associate_id.strip())
            if assoc_record:
                associate = row_to_associate(assoc_record)
                
                # Get project details
                proj_record = sheets_service.get_row_by_id(settings.PROJECTS_SHEET, "Project ID", allocation.project_id.strip())
                project_name = proj_record.get("Project Name", allocation.project_id) if proj_record else allocation.project_id
                
                # Send email
                await email_service.send_allocation_email(
                    associate_email=associate.email,
                    associate_name=associate.associate_name,
                    project_id=allocation.project_id,
                    project_name=project_name
                )
        except Exception as e:
            logger.error(f"Failed to send allocation email: {e}")
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{row_index}", response_model=dict)
async def update_allocation(row_index: int, update: AllocationUpdate):
    """Update an existing allocation by row index."""
    try:
        # Get all records and find the one at this index
        records = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        if row_index < 2 or row_index > len(records) + 1:
            raise HTTPException(status_code=404, detail="Allocation not found")
        
        current_record = records[row_index - 2]
        current_allocation = row_to_allocation(current_record)
        
        update_data = update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(current_allocation, key, value)
        
        merged = AllocationCreate(**current_allocation.model_dump(exclude={"row_index"}))
        row = allocation_to_row(merged)
        
        result = sheets_service.update_row(settings.ALLOCATIONS_SHEET, row_index, row)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{row_index}", response_model=dict)
async def delete_allocation(row_index: int):
    """Delete an allocation by row index."""
    try:
        result = sheets_service.delete_row(settings.ALLOCATIONS_SHEET, row_index)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/by-month", response_model=List[dict])
async def get_allocations_by_month(
    year: int = Query(..., description="Year"),
    month: int = Query(..., description="Month (1-12)")
):
    """Get allocations active during a specific month."""
    try:
        project_map, associate_map = _get_master_lookups()
        records = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        
        # Calculate target month range
        target_start = datetime(year, month, 1)
        if month == 12:
            target_end = datetime(year + 1, 1, 1)
        else:
            target_end = datetime(year, month + 1, 1)
        
        allocations_by_associate = {}
        
        for r in records:
            if not r.get("Associate ID"):
                continue
            
            try:
                start_str = r.get("Allocation Start Date", "")
                end_str = r.get("Allocation End Date", "")
                
                # Parse dates (try multiple formats)
                alloc_start = None
                alloc_end = None
                
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]:
                    try:
                        if start_str:
                            alloc_start = datetime.strptime(start_str, fmt)
                        break
                    except ValueError:
                        continue
                
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]:
                    try:
                        if end_str:
                            alloc_end = datetime.strptime(end_str, fmt)
                        break
                    except ValueError:
                        continue
                
                # If no end date, assume ongoing
                if not alloc_end:
                    alloc_end = datetime(2099, 12, 31)
                
                if not alloc_start:
                    continue
                
                # Check if allocation overlaps with target month
                if alloc_start < target_end and alloc_end >= target_start:
                    associate_id = str(r.get("Associate ID")).strip()
                    pid = str(r.get("Project ID", "")).strip()
                    
                    if associate_id not in allocations_by_associate:
                        allocations_by_associate[associate_id] = {
                            "associate_id": associate_id,
                            "associate_name": associate_map.get(associate_id, r.get("Associate Name", "")),
                            "allocations": []
                        }
                    
                    allocations_by_associate[associate_id]["allocations"].append({
                        "project_id": pid,
                        "project_name": project_map.get(pid, r.get("Project Name", "")),
                        "allocation_type": r.get("Allocation Type"),
                        "allocation_percentage": float(r.get("Allocation %", 100) or 100)
                    })
            except Exception:
                continue
        
        return list(allocations_by_associate.values())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/associate/{associate_id}", response_model=List[Allocation])
async def get_associate_allocations(associate_id: str):
    """Get all allocations for a specific associate."""
    try:
        project_map, associate_map = _get_master_lookups()
        records = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        allocations = []
        for idx, r in enumerate(records):
        #for idx, r in enumerate(records):
            # Normalize ID for comparison
            r_associate_id = str(r.get("Associate ID", "")).strip()
            if r_associate_id == str(associate_id).strip():
                pid = str(r.get("Project ID", "")).strip()
                aid = str(r.get("Associate ID", "")).strip()
                enriched_r = r.copy()
                if pid in project_map: enriched_r["Project Name"] = project_map[pid]
                if aid in associate_map: enriched_r["Associate Name"] = associate_map[aid]
                allocations.append(row_to_allocation(enriched_r, idx + 2))
        return allocations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/project/{project_id}", response_model=List[Allocation])
async def get_project_allocations(project_id: str):
    """Get all allocations for a specific project."""
    try:
        project_map, associate_map = _get_master_lookups()
        records = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        allocations = []
        for idx, r in enumerate(records):
        #for idx, r in enumerate(records):
            # Normalize ID for comparison
            r_project_id = str(r.get("Project ID", "")).strip()
            if r_project_id == str(project_id).strip():
                pid = str(r.get("Project ID", "")).strip()
                aid = str(r.get("Associate ID", "")).strip()
                enriched_r = r.copy()
                if pid in project_map: enriched_r["Project Name"] = project_map[pid]
                if aid in associate_map: enriched_r["Associate Name"] = associate_map[aid]
                allocations.append(row_to_allocation(enriched_r, idx + 2))
        return allocations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
