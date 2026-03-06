from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import logging
import traceback
import uuid

from models.crms.call_log import CallLog, CallLogCreate, CallLogUpdate
from services.google_sheets import sheets_service
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crms/calls", tags=["CRMS - Call Logs"])

SHEET_NAME = settings.CRMS_CALLS_SHEET
ID_COLUMN = "Log Id"


def generate_call_id():
    """Generate a unique call log ID in format GTCALXXXXXX."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        max_id = 0
        for record in records:
            call_id = str(record.get("Log Id", ""))
            if call_id.startswith("GTCAL"):
                try:
                    num_part = int(call_id[5:])
                    if num_part > max_id:
                        max_id = num_part
                except ValueError:
                    continue
        
        next_id = max_id + 1
        return f"GTCAL{next_id:06d}"
    except Exception as e:
        logger.error(f"Error generating call ID: {e}")
        return f"GTCAL-{uuid.uuid4().hex[:6].upper()}"


def safe_int(value) -> int:
    """Safely convert value to int, defaulting to 0."""
    try:
        if isinstance(value, str):
            value = value.strip()
        return int(float(value)) if value else 0
    except (ValueError, TypeError):
        return 0


@router.get("", response_model=List[CallLog])
async def get_calls(
    contact_id: Optional[str] = None,
    direction: Optional[str] = None,
    outcome: Optional[str] = None
):
    """Get all call logs with optional filters."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        calls = []
        
        for record in records:
            if contact_id and record.get("Contact Id", "") != contact_id:
                continue
            if direction and record.get("Direction", "") != direction:
                continue
            if outcome and record.get("Outcome", "") != outcome:
                continue
            
            calls.append(CallLog(
                id=str(record.get("Log Id", "")),
                contact_id=str(record.get("Contact Id", "") or ""),
                direction=str(record.get("Direction", "Outbound") or ""),
                duration=safe_int(record.get("Duration (Seconds)") or 0),
                outcome=str(record.get("Outcome", "") or ""),
                notes=str(record.get("Notes", "") or ""),
                call_date=str(record.get("Call Date", "") or ""),
                created_by=str(record.get("Created By", "") or ""),
                created_at=str(record.get("Created On", "") or "")
            ))
        
        return calls
    except Exception as e:
        logger.error(f"Error getting calls: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{call_id}", response_model=CallLog)
async def get_call(call_id: str):
    """Get a single call log by ID."""
    try:
        record = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, call_id)
        if not record:
            raise HTTPException(status_code=404, detail="Call log not found")
        
        return CallLog(
            id=str(record.get("Log Id", "")),
            contact_id=str(record.get("Contact Id", "") or ""),
            direction=str(record.get("Direction", "Outbound") or ""),
            duration=safe_int(record.get("Duration (Seconds)") or 0),
            outcome=str(record.get("Outcome", "") or ""),
            notes=str(record.get("Notes", "") or ""),
            call_date=str(record.get("Call Date", "") or ""),
            created_by=str(record.get("Created By", "") or ""),
            created_at=str(record.get("Created On", "") or "")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=CallLog)
async def create_call(call: CallLogCreate, created_by: Optional[str] = None):
    """Create a new call log."""
    try:
        call_id = generate_call_id()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Headers: Log Id, Contact Id, Direction, Outcome, Duration (Seconds), Call Date, Notes, Created On, Created By
        values = [
            call_id,
            call.contact_id,
            call.direction,
            call.outcome,
            call.duration,
            call.call_date,
            call.notes,
            created_by or "",  # Created By (at end or wherever configured, let's append it)
            now                # Created On
        ]
        
        # Adjust order if Created On is expected before Created By based on user requirement
        # User said: Log Id, Contact Id, Direction, Outcome, Duration (Seconds), Call Date, Notes, Created On
        # Created By wasn't explicitly mentioned in the list but was in previous code.
        # I will assume "Created By" is extra or maybe not needed in sheet explicitly if not asked?
        # But previous code had it. I'll include it at the end to be safe, or just stick to user list exactly + Created By if needed.
        # User list: Log Id Contact Id Direction Outcome Duration (Seconds) Call Date Notes Created On
        # Let's clean the values list to match exactly that order:
        
        values = [
            call_id,                        # Log Id
            call.contact_id,                # Contact Id
            call.direction,                 # Direction
            call.outcome,                   # Outcome
            call.duration,                  # Duration (Seconds)
            call.call_date,                 # Call Date
            call.notes,                     # Notes
            now,                            # Created On
            created_by or ""                # Created By (optional extra column)
        ]
        
        sheets_service.crms_append_row(SHEET_NAME, values)
        
        return CallLog(
            id=call_id,
            contact_id=call.contact_id,
            direction=call.direction,
            duration=call.duration,
            outcome=call.outcome,
            notes=call.notes,
            call_date=call.call_date,
            created_by=created_by,
            created_at=now
        )
    except Exception as e:
        logger.error(f"Error creating call: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{call_id}", response_model=CallLog)
async def update_call(call_id: str, update: CallLogUpdate):
    """Update an existing call log."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, call_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Call log not found")
        
        existing = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, call_id)
        
        # Headers: Log Id, Contact Id, Direction, Outcome, Duration (Seconds), Call Date, Notes, Created On, Created By
        values = [
            call_id,
            update.contact_id if update.contact_id is not None else existing.get("Contact Id", ""),
            update.direction if update.direction is not None else existing.get("Direction", "Outbound"),
            update.outcome if update.outcome is not None else existing.get("Outcome", ""),
            update.duration if update.duration is not None else existing.get("Duration (Seconds)", 0),
            update.call_date if update.call_date is not None else existing.get("Call Date", ""),
            update.notes if update.notes is not None else existing.get("Notes", ""),
            existing.get("Created On", ""),
            existing.get("Created By", "")
        ]
        
        sheets_service.crms_update_row(SHEET_NAME, row_index, values)
        
        return CallLog(
            id=call_id,
            contact_id=str(values[1] or ""),
            direction=str(values[2] or ""),
            duration=safe_int(values[4] or 0), # Index 4 is duration
            outcome=str(values[3] or ""),    # Index 3 is outcome
            notes=str(values[6] or ""),
            call_date=str(values[5] or ""),
            created_by=str(values[7] or ""),
            created_at=str(values[8] or "")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{call_id}")
async def delete_call(call_id: str):
    """Delete a call log."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, call_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Call log not found")
        
        sheets_service.crms_delete_row(SHEET_NAME, row_index)
        return {"success": True, "message": "Call log deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
