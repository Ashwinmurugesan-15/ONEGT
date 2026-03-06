import logging
import traceback
import re
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from services.google_sheets import sheets_service
from models.hrms.project import (
    Project, ProjectCreate, ProjectUpdate,
    project_to_row, row_to_project, PROJECT_COLUMNS
)
from config import settings
from fastapi import Depends
from middleware.auth_middleware import get_current_user, TokenData
from utils.logging_utils import trace_exceptions_async

logger = logging.getLogger("chrms.projects")

router = APIRouter()

def get_quarter(month: int) -> int:
    """Get quarter number (1-4) from month (1-12)."""
    return ((month - 1) // 3) + 1

@router.get("/generate-id")
@trace_exceptions_async
async def generate_project_id(year: int, month: int):
    """Generate next project ID based on pattern PR{year}Q{quarter}{4-digit}."""
    quarter = get_quarter(month)
    prefix = f"PR{year}Q{quarter}"
    
    # Get all existing projects
    records = sheets_service.get_all_records(settings.PROJECTS_SHEET)
    
    # Find all project IDs matching this prefix
    max_seq = 0
    pattern = re.compile(rf"^{prefix}(\d{{4}})$")
    
    for r in records:
        pid = str(r.get("Project ID", ""))
        match = pattern.match(pid)
        if match:
            seq = int(match.group(1))
            if seq > max_seq:
                max_seq = seq
    
    # Generate next sequence
    next_seq = max_seq + 1
    new_id = f"{prefix}{next_seq:04d}"
    
    logger.info(f"Generated project ID: {new_id}")
    return {"project_id": new_id}

@router.get("/", response_model=List[Project])
@trace_exceptions_async
async def get_projects(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get all projects.
    - Admins see all projects and all fields.
    - Managers see only their projects and cannot see SOW details.
    """
    logger.info(f"Fetching projects for user: {current_user.email} ({current_user.role})")
    # Ensure sheet has proper columns
    sheets_service.create_sheet_if_not_exists(settings.PROJECTS_SHEET, PROJECT_COLUMNS)
    records = sheets_service.get_all_records(settings.PROJECTS_SHEET)
    logger.info(f"Found {len(records)} raw records from sheet")
    
    projects = []
    is_admin_user = (current_user.role.lower() == "admin")
    
    for r in records:
        project_id = r.get("Project ID")
        
        if project_id:
            try:
                project = row_to_project(r)
                
                # RBAC Filtering: If not Admin, only show projects where user is PM
                if not is_admin_user:
                    # Check if current user is the project manager
                    if project.project_manager_id != current_user.associate_id:
                        continue
                
                projects.append(project)
            except Exception as row_error:
                logger.warning(f"Error parsing row {project_id}: {row_error}")
                logger.warning(traceback.format_exc())
        else:
            logger.debug(f"Skipping record without Project ID: {r}")
    
    logger.info(f"Returning {len(projects)} parsed projects")
    return projects

@router.get("/stats")
async def get_project_stats(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get project statistics grouped by type and status.
    - Admins see stats for all projects.
    - Managers see stats only for their assigned projects.
    """
    try:
        logger.info(f"Fetching project statistics for user: {current_user.email} ({current_user.role})")
        records = sheets_service.get_all_records(settings.PROJECTS_SHEET)
        
        # Initialize counters
        stats = {
            "by_type": {},
            "by_status": {},
            "by_type_and_status": {}
        }
        
        is_admin_user = (current_user.role.lower() == "admin")
        
        for r in records:
            if not r.get("Project ID"):
                continue
            
            # RBAC Filtering
            if not is_admin_user:
                # Check if current user is the project manager
                # Note: We need to match against the Project Manager ID in the sheet
                pm_id = str(r.get("Project Manager ID", "")).strip()
                if pm_id != current_user.associate_id:
                    continue
            
            project_type = str(r.get("Type", "")).strip()
            status = str(r.get("Status", "")).strip()
            
            # Count by type (exact value)
            if project_type:
                stats["by_type"][project_type] = stats["by_type"].get(project_type, 0) + 1
            
            # Count by status (exact value)
            if status:
                stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
            
            # Count by type and status combination
            if project_type and status:
                key = f"{project_type}_{status}"
                stats["by_type_and_status"][key] = stats["by_type_and_status"].get(key, 0) + 1
        
        # Helper function to find count with case-insensitive matching
        def find_count(data_dict, search_term):
            """Find count in dictionary with case-insensitive matching."""
            search_lower = search_term.lower().replace(" ", "")
            for key, value in data_dict.items():
                if key.lower().replace(" ", "") == search_lower:
                    return value
            return 0
        
        def find_combined_count(data_dict, type_term, status_term):
            """Find combined count with case-insensitive matching."""
            type_lower = type_term.lower().replace(" ", "")
            status_lower = status_term.lower().replace(" ", "")
            for key, value in data_dict.items():
                parts = key.split("_", 1)
                if len(parts) == 2:
                    key_type = parts[0].lower().replace(" ", "")
                    key_status = parts[1].lower().replace(" ", "")
                    if key_type == type_lower and key_status == status_lower:
                        return value
            return 0
        
        # Add convenience fields for commonly used stats (case-insensitive)
        stats["active_revenue"] = find_combined_count(stats["by_type_and_status"], "Revenue", "Active")
        stats["active_investment"] = find_combined_count(stats["by_type_and_status"], "Investment", "Active")
        stats["in_progress_revenue"] = find_combined_count(stats["by_type_and_status"], "Revenue", "In Progress")
        stats["in_progress_investment"] = find_combined_count(stats["by_type_and_status"], "Investment", "In Progress")
        stats["completed"] = find_count(stats["by_status"], "Completed")
        stats["in_progress"] = find_count(stats["by_status"], "In Progress")
        
        # Count total filtered records
        filtered_count = 0
        for r in records:
            if not r.get("Project ID"):
                continue
            if not is_admin_user:
                pm_id = str(r.get("Project Manager ID", "")).strip()
                if pm_id != current_user.associate_id:
                    continue
            filtered_count += 1
            
        stats["total"] = filtered_count
        
        logger.info(f"Project stats: {stats}")
        return stats
    except Exception as e:
        logger.error(f"Error fetching project stats: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str):
    """Get a single project by ID."""
    try:
        logger.info(f"Fetching project: {project_id}")
        record = sheets_service.get_row_by_id(
            settings.PROJECTS_SHEET, "Project ID", project_id
        )
        if not record:
            raise HTTPException(status_code=404, detail="Project not found")
        return row_to_project(record)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching project {project_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=dict)
async def create_project(project: ProjectCreate):
    """Create a new project."""
    try:
        logger.info(f"Creating project: {project.project_id}")
        existing = sheets_service.get_row_by_id(
            settings.PROJECTS_SHEET, "Project ID", project.project_id
        )
        if existing:
            raise HTTPException(status_code=400, detail="Project ID already exists")
        
        row = project_to_row(project)
        result = sheets_service.append_row(settings.PROJECTS_SHEET, row)
        logger.info(f"Project created: {project.project_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{project_id}", response_model=dict)
async def update_project(project_id: str, update: ProjectUpdate):
    """Update an existing project."""
    try:
        logger.info(f"Updating project: {project_id}")
        row_index = sheets_service.find_row_index(
            settings.PROJECTS_SHEET, "Project ID", project_id
        )
        if not row_index:
            raise HTTPException(status_code=404, detail="Project not found")
        
        current = sheets_service.get_row_by_id(
            settings.PROJECTS_SHEET, "Project ID", project_id
        )
        current_project = row_to_project(current)
        
        update_data = update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(current_project, key, value)
        
        merged = ProjectCreate(
            project_id=project_id,
            **current_project.model_dump(exclude={"project_id"})
        )
        row = project_to_row(merged)
        
        result = sheets_service.update_row(settings.PROJECTS_SHEET, row_index, row)
        logger.info(f"Project updated: {project_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project {project_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{project_id}", response_model=dict)
async def delete_project(project_id: str):
    """Delete a project."""
    try:
        logger.info(f"Deleting project: {project_id}")
        row_index = sheets_service.find_row_index(
            settings.PROJECTS_SHEET, "Project ID", project_id
        )
        if not row_index:
            raise HTTPException(status_code=404, detail="Project not found")
        
        result = sheets_service.delete_row(settings.PROJECTS_SHEET, row_index)
        logger.info(f"Project deleted: {project_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{status}", response_model=List[Project])
async def get_projects_by_status(status: str):
    """Get projects filtered by status."""
    try:
        logger.info(f"Fetching projects by status: {status}")
        records = sheets_service.get_all_records(settings.PROJECTS_SHEET)
        filtered = []
        for r in records:
            if r.get("Project ID") and r.get("Status", "").lower() == status.lower():
                try:
                    filtered.append(row_to_project(r))
                except Exception as row_error:
                    logger.warning(f"Error parsing row {r.get('Project ID')}: {row_error}")
        return filtered
    except Exception as e:
        logger.error(f"Error fetching projects by status: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/customer/{customer_id}", response_model=List[Project])
async def get_projects_by_customer(customer_id: str):
    """Get projects filtered by customer ID."""
    try:
        logger.info(f"Fetching projects by customer: {customer_id}")
        records = sheets_service.get_all_records(settings.PROJECTS_SHEET)
        filtered = []
        for r in records:
            if r.get("Project ID") and customer_id.lower() in str(r.get("Customer ID", "")).lower():
                try:
                    filtered.append(row_to_project(r))
                except Exception as row_error:
                    logger.warning(f"Error parsing row {r.get('Project ID')}: {row_error}")
        return filtered
    except Exception as e:
        logger.error(f"Error fetching projects by customer: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
