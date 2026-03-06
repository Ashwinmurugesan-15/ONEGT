from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import logging
import traceback
import uuid

from models.crms.deal import Deal, DealCreate, DealUpdate
from services.google_sheets import sheets_service
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crms/deals", tags=["CRMS - Deals"])

SHEET_NAME = settings.CRMS_DEALS_SHEET
ID_COLUMN = "Deal ID"


def generate_deal_id():
    """Generate a unique deal ID in format GTDLXXXXXX."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        max_id = 0
        for record in records:
            deal_id = str(record.get("Deal ID", ""))
            if deal_id.startswith("GTDL"):
                try:
                    num_part = int(deal_id[4:])
                    if num_part > max_id:
                        max_id = num_part
                except ValueError:
                    continue
        
        next_id = max_id + 1
        return f"GTDL{next_id:06d}"
    except Exception as e:
        logger.error(f"Error generating deal ID: {e}")
        return f"GTDL-{uuid.uuid4().hex[:6].upper()}"


@router.get("", response_model=List[Deal])
async def get_deals(
    stage: Optional[str] = None,
    customer_id: Optional[str] = None,
    owner_id: Optional[str] = None
):
    """Get all deals with optional filters."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        deals = []
        
        for record in records:
            if stage and record.get("Stage", "") != stage:
                continue
            if customer_id and record.get("Customer ID", "") != customer_id:
                continue
            if owner_id and record.get("Owner ID", "") != owner_id:
                continue
            
            # Safe parsing helpers
            def safe_float(val):
                try:
                    if val is None or val == "": return 0.0
                    if isinstance(val, (int, float)): return float(val)
                    return float(str(val).replace(',', '').replace('$', '').strip())
                except:
                    return 0.0

            deals.append(Deal(
                id=str(record.get("Deal ID", "")),
                customer_id=str(record.get("Customer ID", "") or "") or None,
                name=record.get("Deal Name", "") or record.get("Name", ""),
                value=safe_float(record.get("Value", 0)),
                currency=record.get("Currency", "USD"),
                stage=record.get("Stage", "Prospecting"),
                close_date=record.get("Close Date", "") or None,
                start_date=record.get("Start Date", "") or None,
                end_date=record.get("End Date", "") or None,
                owner_id=str(record.get("Owner", "") or record.get("Owner ID", "") or "") or None,
                notes=record.get("Notes", "") or None,
                sow_number=record.get("SOW Number", "") or None,
                sow=record.get("SOW", "") or record.get("SOW Link", "") or None,
                po_number=record.get("PO Number", "") or None,
                created_at=record.get("Created On", "") or record.get("Created At", "") or None,
                updated_at=record.get("Updated On", "") or record.get("Updated At", "") or None
            ))
        
        return deals
    except Exception as e:
        logger.error(f"Error in get_deals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{deal_id}", response_model=Deal)
async def get_deal(deal_id: str):
    """Get a single deal by ID."""
    try:
        record = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, deal_id)
        if not record:
            raise HTTPException(status_code=404, detail="Deal not found")
        
        # Safe parsing helper
        def safe_float(val):
            try:
                if val is None or val == "": return 0.0
                if isinstance(val, (int, float)): return float(val)
                return float(str(val).replace(',', '').replace('$', '').strip())
            except:
                return 0.0

        return Deal(
            id=str(record.get("Deal ID", "")),
            customer_id=str(record.get("Customer ID", "") or "") or None,
            name=record.get("Deal Name", "") or record.get("Name", ""),
            value=safe_float(record.get("Value", 0)),
            currency=record.get("Currency", "USD"),
            stage=record.get("Stage", "Prospecting"),
            close_date=record.get("Close Date", "") or None,
            start_date=record.get("Start Date", "") or None,
            end_date=record.get("End Date", "") or None,
            owner_id=str(record.get("Owner", "") or record.get("Owner ID", "") or "") or None,
            notes=record.get("Notes", "") or None,
            sow_number=record.get("SOW Number", "") or None,
            sow=record.get("SOW", "") or record.get("SOW Link", "") or None,
            po_number=record.get("PO Number", "") or None,
            created_at=record.get("Created On", "") or record.get("Created At", "") or None,
            updated_at=record.get("Updated On", "") or record.get("Updated At", "") or None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Deal)
async def create_deal(deal: DealCreate):
    """Create a new deal."""
    try:
        deal_id = generate_deal_id()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Headers: Deal ID, Deal Name, Currency, Value, Customer ID, Stage, Close Date, Start Date, End Date, Owner, SOW Number, SOW, PO Number, Notes, Created On, Updated On
        values = [
            deal_id,
            deal.name,
            deal.currency,
            deal.value,
            deal.customer_id or "",
            deal.stage,
            deal.close_date or "",
            deal.start_date or "",
            deal.end_date or "",
            deal.owner_id or "",
            deal.sow_number or "",
            deal.sow or "",
            deal.po_number or "",
            deal.notes or "",
            now,
            now
        ]
        
        sheets_service.crms_append_row(SHEET_NAME, values)
        
        return Deal(
            id=deal_id,
            customer_id=deal.customer_id,
            name=deal.name,
            value=deal.value,
            currency=deal.currency,
            stage=deal.stage,
            close_date=deal.close_date,
            start_date=deal.start_date,
            end_date=deal.end_date,
            owner_id=deal.owner_id,
            notes=deal.notes,
            sow_number=deal.sow_number,
            sow=deal.sow,
            po_number=deal.po_number,
            created_at=now,
            updated_at=now
        )
    except Exception as e:
        logger.error(f"Error creating deal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{deal_id}", response_model=Deal)
async def update_deal(deal_id: str, update: DealUpdate):
    """Update an existing deal."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, deal_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Deal not found")
        
        existing = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, deal_id)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Headers: Deal ID, Deal Name, Currency, Value, Customer ID, Stage, Close Date, Start Date, End Date, Owner, SOW Number, SOW, PO Number, Notes, Created On, Updated On
        
        # Helper to safely handle float
        def safe_float(val):
            try:
                if val is None or val == "": return 0.0
                if isinstance(val, (int, float)): return float(val)
                return float(str(val).replace(',', '').replace('$', '').strip())
            except:
                return 0.0
                
        values = [
            deal_id,
            update.name if update.name is not None else (existing.get("Deal Name") or existing.get("Name", "")),
            update.currency if update.currency is not None else existing.get("Currency", "USD"),
            update.value if update.value is not None else safe_float(existing.get("Value")),
            update.customer_id if update.customer_id is not None else str(existing.get("Customer ID", "") or ""),
            update.stage if update.stage is not None else existing.get("Stage", "Prospecting"),
            update.close_date if update.close_date is not None else existing.get("Close Date", ""),
            update.start_date if update.start_date is not None else existing.get("Start Date", ""),
            update.end_date if update.end_date is not None else existing.get("End Date", ""),
            update.owner_id if update.owner_id is not None else str(existing.get("Owner", "") or existing.get("Owner ID", "") or ""),
            update.sow_number if update.sow_number is not None else existing.get("SOW Number", ""),
            update.sow if update.sow is not None else (existing.get("SOW") or existing.get("SOW Link", "")),
            update.po_number if update.po_number is not None else existing.get("PO Number", ""),
            update.notes if update.notes is not None else existing.get("Notes", ""),
            existing.get("Created On") or existing.get("Created At", ""),
            now
        ]
        
        sheets_service.crms_update_row(SHEET_NAME, row_index, values)

        return Deal(
            id=deal_id,
            name=values[1],
            currency=values[2],
            value=safe_float(values[3]),
            customer_id=values[4] or None,
            stage=values[5],
            close_date=values[6] or None,
            start_date=values[7] or None,
            end_date=values[8] or None,
            owner_id=values[9] or None,
            sow_number=values[10] or None,
            sow=values[11] or None,
            po_number=values[12] or None,
            notes=values[13] or None,
            created_at=values[14],
            updated_at=now
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{deal_id}")
async def delete_deal(deal_id: str):
    """Delete a deal."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, deal_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Deal not found")
        
        sheets_service.crms_delete_row(SHEET_NAME, row_index)
        return {"success": True, "message": "Deal deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
