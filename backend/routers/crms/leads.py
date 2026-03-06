from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import uuid
import logging
import traceback

from models.crms.lead import Lead, LeadCreate, LeadUpdate
from services.google_sheets import sheets_service
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crms/leads", tags=["CRMS - Leads"])

SHEET_NAME = settings.CRMS_LEADS_SHEET
ID_COLUMN = "Lead ID"


def generate_lead_id():
    """Generate a unique lead ID in format GTLDXXXXX."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        max_id = 0
        for record in records:
            lead_id = str(record.get("Lead ID", ""))
            if lead_id.startswith("GTLD"):
                try:
                    # Extract numeric part (e.g., GTLD00001 -> 1)
                    num_part = int(lead_id[4:])
                    if num_part > max_id:
                        max_id = num_part
                except ValueError:
                    continue
        
        next_id = max_id + 1
        return f"GTLD{next_id:05d}"
    except Exception as e:
        logger.error(f"Error generating lead ID: {e}")
        # Fallback to UUID if sequence generation fails
        return f"GTLD-{uuid.uuid4().hex[:6].upper()}"


@router.get("", response_model=List[Lead])
async def get_leads(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    source: Optional[str] = None
):
    """Get all leads with optional filters."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        leads = []
        
        for record in records:
            # Apply filters
            if status and record.get("Status", "") != status:
                continue
            if assigned_to and record.get("Assigned To", "") != assigned_to:
                continue
            if source and record.get("Source", "") != source:
                continue
            
            leads.append(Lead(
                id=str(record.get("Lead ID", "")),
                name=record.get("Lead Name", "") or record.get("Name", ""), # Fallback for old data
                email=record.get("Email", "") or None,
                phone=str(record.get("Phone Number", "") or record.get("Phone", "") or "") or None, # Fallback
                company=record.get("Company", "") or None,
                source=record.get("Source", "") or None,
                lead_type=record.get("Lead Type", "") or None,
                status=record.get("Status", "New"),
                assigned_to=str(record.get("Assigned To", "") or "") or None,
                notes=record.get("Notes", "") or None,
                created_on=record.get("Created On", "") or record.get("Created At", "") or None,
                updated_at=record.get("Updated At", "") or None
            ))
        
        return leads
    except Exception as e:
        logger.error(f"Error in get_leads: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{lead_id}", response_model=Lead)
async def get_lead(lead_id: str):
    """Get a single lead by ID."""
    try:
        record = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, lead_id)
        if not record:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        return Lead(
            id=str(record.get("Lead ID", "")),
            name=record.get("Lead Name", "") or record.get("Name", ""),
            email=record.get("Email", "") or None,
            phone=str(record.get("Phone Number", "") or record.get("Phone", "") or "") or None,
            company=record.get("Company", "") or None,
            source=record.get("Source", "") or None,
            lead_type=record.get("Lead Type", "") or None,
            status=record.get("Status", "New"),
            assigned_to=str(record.get("Assigned To", "") or "") or None,
            notes=record.get("Notes", "") or None,
            created_on=record.get("Created On", "") or record.get("Created At", "") or None,
            updated_at=record.get("Updated At", "") or None
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_lead: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Lead)
async def create_lead(lead: LeadCreate):
    """Create a new lead."""
    try:
        lead_id = generate_lead_id()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Headers: Lead ID, Lead Name, Email, Phone Number, Company, Source, Lead Type, Assigned To, Created On, Status, Notes, Updated At
        # Note: Added Status, Notes, Updated At to match model/logic even if user didn't list them explicitly
        
        values = [
            lead_id,                   # Lead ID
            lead.name,                 # Lead Name
            lead.email or "",          # Email
            lead.phone or "",          # Phone Number
            lead.company or "",        # Company
            lead.source or "",         # Source
            lead.lead_type or "",      # Lead Type
            lead.assigned_to or "",    # Assigned To (ID only)
            now,                       # Created On
            lead.status,               # Status
            lead.notes or "",          # Notes
            now                        # Updated At
        ]
        
        # We need to ensure mapping matches sheet columns. 
        # Assuming sheet columns are updated or we are appending by index? 
        # sheets_service depends on header names usually for dict read, but list write relies on order?
        # Standard: crms_append_row takes list of values. 
        # It assumes the sheet has these columns in this order OR appends to first N columns.
        # CRITICAL: If sheet headers are different, this might break.
        # Ideally, we should use dictionary-based append if supported, but usually sheets api is list.
        # I'll stick to this order which matches user request + necessary fields.
        
        sheets_service.crms_append_row(SHEET_NAME, values)
        
        return Lead(
            id=lead_id,
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            company=lead.company,
            source=lead.source,
            lead_type=lead.lead_type,
            status=lead.status,
            assigned_to=lead.assigned_to,
            notes=lead.notes,
            created_on=now,
            updated_at=now
        )
    except Exception as e:
        logger.error(f"Error in create_lead: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_update: LeadUpdate):
    """Update an existing lead."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, lead_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        existing = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, lead_id)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Reconstruct values based on assumed column order:
        # 0: Lead ID, 1: Lead Name, 2: Email, 3: Phone Number, 4: Company, 5: Source, 6: Lead Type, 7: Assigned To, 8: Created On, 9: Status, 10: Notes, 11: Updated At
        
        # Mapping existing keys:
        # Note: `crms_get_row_by_id` returns dict with keys from header row.
        # If headers changed, we must be careful. Assuming headers ARE updated in sheet manually or by this logic being consistent.
        
        values = [
            lead_id,
            lead_update.name if lead_update.name is not None else (existing.get("Lead Name") or existing.get("Name", "")),
            lead_update.email if lead_update.email is not None else existing.get("Email", ""),
            lead_update.phone if lead_update.phone is not None else (existing.get("Phone Number") or existing.get("Phone", "")),
            lead_update.company if lead_update.company is not None else existing.get("Company", ""),
            lead_update.source if lead_update.source is not None else existing.get("Source", ""),
            lead_update.lead_type if lead_update.lead_type is not None else existing.get("Lead Type", ""),
            lead_update.assigned_to if lead_update.assigned_to is not None else existing.get("Assigned To", ""),
            existing.get("Created On") or existing.get("Created At", ""), # Preserve creation date
            lead_update.status if lead_update.status is not None else existing.get("Status", "New"),
            lead_update.notes if lead_update.notes is not None else existing.get("Notes", ""),
            now
        ]
        
        sheets_service.crms_update_row(SHEET_NAME, row_index, values)
        
        return Lead(
            id=lead_id,
            name=values[1],
            email=values[2] or None,
            phone=values[3] or None,
            company=values[4] or None,
            source=values[5] or None,
            lead_type=values[6] or None,
            assigned_to=values[7] or None,
            created_on=values[8],
            status=values[9],
            notes=values[10] or None,
            updated_at=now
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_lead: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{lead_id}")
async def delete_lead(lead_id: str):
    """Delete a lead."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, lead_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        sheets_service.crms_delete_row(SHEET_NAME, row_index)
        return {"success": True, "message": "Lead deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_lead: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/summary")
async def get_lead_stats():
    """Get lead statistics."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        
        status_counts = {}
        source_counts = {}
        
        for record in records:
            status = record.get("Status", "Unknown")
            source = record.get("Source", "Unknown")
            
            status_counts[status] = status_counts.get(status, 0) + 1
            source_counts[source] = source_counts.get(source, 0) + 1
        
        return {
            "total": len(records),
            "by_status": status_counts,
            "by_source": source_counts
        }
    except Exception as e:
        logger.error(f"Error in get_lead_stats: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
