from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import logging
import traceback
import uuid

from models.crms.opportunity import Opportunity, OpportunityCreate, OpportunityUpdate
from services.google_sheets import sheets_service
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crms/opportunities", tags=["CRMS - Opportunities"])

SHEET_NAME = settings.CRMS_OPPORTUNITIES_SHEET
ID_COLUMN = "Opportunity ID"


def generate_opportunity_id():
    """Generate a unique opportunity ID in format GTOPYXXXXXX."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        max_id = 0
        for record in records:
            opp_id = str(record.get("Opportunity ID", ""))
            if opp_id.startswith("GTOPY"):
                try:
                    # Extract numeric part (e.g., GTOPY000001 -> 1)
                    num_part = int(opp_id[5:])
                    if num_part > max_id:
                        max_id = num_part
                except ValueError:
                    continue
        
        next_id = max_id + 1
        return f"GTOPY{next_id:06d}"
    except Exception as e:
        logger.error(f"Error generating opportunity ID: {e}")
        # Fallback to UUID
        return f"GTOPY-{uuid.uuid4().hex[:6].upper()}"


@router.get("", response_model=List[Opportunity])
async def get_opportunities(
    stage: Optional[str] = None,
    assigned_to: Optional[str] = None
):
    """Get all opportunities with optional filters."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        opportunities = []
        
        for record in records:
            if stage and record.get("Stage", "") != stage:
                continue
            if assigned_to and record.get("Assigned To", "") != assigned_to:
                continue
            
            try:
                # Sheet Headers: Opportunity ID, Opportunity Name, Lead Id, Currency, Value, Stage, Probability, Expected Close Date, Assigned To, Notes, Created On, Updated On
                
                import re
                
                # Safe parsing helper
                def safe_float(val):
                    try:
                        if isinstance(val, (int, float)): return float(val)
                        if not val: return 0.0
                        cleaned = re.sub(r'[^\d.-]', '', str(val))
                        return float(cleaned) if cleaned else 0.0
                    except:
                        return 0.0

                def safe_int(val):
                    try:
                        if isinstance(val, int): return val
                        if not val: return 0
                        cleaned = re.sub(r'[^\d.-]', '', str(val))
                        return int(float(cleaned)) if cleaned else 0
                    except:
                        return 0

                opportunities.append(Opportunity(
                    id=str(record.get("Opportunity ID", "")),
                    lead_id=str(record.get("Lead Id", "") or "") or None, 
                    name=record.get("Opportunity Name", "") or record.get("Name", ""),
                    value=safe_float(record.get("Value", 0)),
                    currency=record.get("Currency", "USD"), 
                    stage=record.get("Stage", "Qualification"),
                    probability=safe_int(record.get("Probability", 0)),
                    expected_close=record.get("Expected Close Date", "") or record.get("Expected Close", "") or None,
                    assigned_to=str(record.get("Assigned To", "") or "") or None, 
                    notes=record.get("Notes", "") or None,
                    created_on=record.get("Created On", "") or record.get("Created At", "") or None,
                    updated_on=record.get("Updated On", "") or record.get("Updated At", "") or None
                ))
            except Exception as e:
                logger.error(f"Error parsing opportunity record: {record}. Error: {e}")
                continue # Skip bad records but allow others to load
        
        return opportunities
    except Exception as e:
        logger.error(f"Error in get_opportunities: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error loading opportunities: {str(e)}")


@router.get("/{opportunity_id}", response_model=Opportunity)
async def get_opportunity(opportunity_id: str):
    """Get a single opportunity by ID."""
    try:
        record = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, opportunity_id)
        if not record:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        return Opportunity(
            id=str(record.get("Opportunity ID", "")),
            lead_id=str(record.get("Lead Id", "") or "") or None,
            name=record.get("Opportunity Name", "") or record.get("Name", ""),
            value=float(record.get("Value", 0) or 0),
            currency=record.get("Currency", "USD"),
            stage=record.get("Stage", "Qualification"),
            probability=int(record.get("Probability", 0) or 0),
            expected_close=record.get("Expected Close Date", "") or record.get("Expected Close", "") or None,
            assigned_to=str(record.get("Assigned To", "") or "") or None,
            notes=record.get("Notes", "") or None,
            created_on=record.get("Created On", "") or record.get("Created At", "") or None,
            updated_on=record.get("Updated On", "") or record.get("Updated At", "") or None
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_opportunity: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Opportunity)
async def create_opportunity(opp: OpportunityCreate):
    """Create a new opportunity."""
    try:
        opp_id = generate_opportunity_id()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Headers: Opportunity ID, Opportunity Name, Lead Id, Currency, Value, Stage, Probability, Expected Close Date, Assigned To, Notes, Created On, Updated On
        values = [
            opp_id,
            opp.name, 
            opp.lead_id or "", 
            opp.currency, 
            opp.value,
            opp.stage,
            opp.probability,
            opp.expected_close or "", 
            opp.assigned_to or "",
            opp.notes or "",
            now, 
            now  
        ]
        
        # Verify column order in sheet matches this list? 
        # "Opportunity ID", "Opportunity Name", "Value", "Stage", "Probability", "Expected Close Date", "Assigned To", "Lead Id", "Notes", "Created On", "Updated On"
        # The user listed them in this order: Opportunity ID, Opportunity Name, Value, Stage, Probability, Expected Close Date, Assigned To, Lead Id, Notes, Created On, Updated On.
        # Wait, my `values` list above has `opp.lead_id` at index 7 (8th item), which matches User's list "Lead Id" (8th item).
        # "Opportunity ID" (1), "Opportunity Name" (2), "Value" (3), "Stage" (4), "Probability" (5), "Expected Close Date" (6), "Assigned To" (7), "Lead Id" (8), "Notes" (9), "Created On" (10), "Updated On" (11).
        
        # My values list:
        # 0: id
        # 1: name (Opportunity Name)
        # 2: value
        # 3: stage
        # 4: probability
        # 5: expected_close
        # 6: assigned_to -> Wait. User list: "... Expected Close Date, Assigned To, Lead Id ..."
        # So Assigned To is BEFORE Lead Id.
        # My list:
        # 0: id
        # 1: name
        # 2: value
        # 3: stage
        # 4: probability
        # 5: expected_close
        # 6: assigned_to
        # 7: lead_id
        # 8: notes
        # 9: created_on
        # 10: updated_on
        
        # This matches user list perfectly.
        
        sheets_service.crms_append_row(SHEET_NAME, values)
        
        return Opportunity(
            id=opp_id,
            lead_id=opp.lead_id,
            name=opp.name,
            value=opp.value,
            currency=opp.currency,
            stage=opp.stage,
            probability=opp.probability,
            expected_close=opp.expected_close,
            assigned_to=opp.assigned_to,
            notes=opp.notes,
            created_on=now,
            updated_on=now
        )
    except Exception as e:
        logger.error(f"Error in create_opportunity: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{opportunity_id}", response_model=Opportunity)
async def update_opportunity(opportunity_id: str, opp_update: OpportunityUpdate):
    """Update an existing opportunity."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, opportunity_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        existing = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, opportunity_id)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Headers: Opportunity ID, Opportunity Name, Lead Id, Currency, Value, Stage, Probability, Expected Close Date, Assigned To, Notes, Created On, Updated On
        
        values = [
            opportunity_id,
            opp_update.name if opp_update.name is not None else (existing.get("Opportunity Name") or existing.get("Name", "")),
            opp_update.lead_id if opp_update.lead_id is not None else existing.get("Lead Id", ""),
            opp_update.currency if opp_update.currency is not None else existing.get("Currency", "USD"),
            opp_update.value if opp_update.value is not None else float(existing.get("Value", 0) or 0),
            opp_update.stage if opp_update.stage is not None else existing.get("Stage", "Qualification"),
            opp_update.probability if opp_update.probability is not None else int(existing.get("Probability", 0) or 0),
            opp_update.expected_close if opp_update.expected_close is not None else (existing.get("Expected Close Date") or existing.get("Expected Close", "")),
            opp_update.assigned_to if opp_update.assigned_to is not None else existing.get("Assigned To", ""),
            opp_update.notes if opp_update.notes is not None else existing.get("Notes", ""),
            existing.get("Created On") or existing.get("Created At", ""),
            now
        ]
        
        sheets_service.crms_update_row(SHEET_NAME, row_index, values)
        
        return Opportunity(
            id=opportunity_id,
            name=values[1],
            lead_id=values[2] or None,
            currency=values[3],
            value=float(values[4]),
            stage=values[5],
            probability=int(values[6]),
            expected_close=values[7] or None,
            assigned_to=values[8] or None,
            notes=values[9] or None,
            created_on=values[10],
            updated_on=now
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_opportunity: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{opportunity_id}")
async def delete_opportunity(opportunity_id: str):
    """Delete an opportunity."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, opportunity_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        
        sheets_service.crms_delete_row(SHEET_NAME, row_index)
        return {"success": True, "message": "Opportunity deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/pipeline")
async def get_pipeline_stats():
    """Get opportunity pipeline statistics."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        
        stages = {}
        total_value = 0
        weighted_value = 0
        
        for record in records:
            try:
                stage = record.get("Stage", "Unknown")
                
                import re
                
                # Safe parsing
                try:
                    val_raw = record.get("Value", 0)
                    if isinstance(val_raw, (int, float)): value = float(val_raw)
                    elif not val_raw: value = 0.0
                    else: 
                        cleaned_val = re.sub(r'[^\d.-]', '', str(val_raw))
                        value = float(cleaned_val) if cleaned_val else 0.0
                except:
                    value = 0.0
                
                try:
                    prob_raw = record.get("Probability", 0)
                    if isinstance(prob_raw, int): prob = prob_raw
                    elif not prob_raw: prob = 0
                    else: 
                        cleaned_prob = re.sub(r'[^\d.-]', '', str(prob_raw))
                        prob = int(float(cleaned_prob)) if cleaned_prob else 0
                except:
                    prob = 0
                
                if stage not in stages:
                    stages[stage] = {"count": 0, "value": 0}
                stages[stage]["count"] += 1
                stages[stage]["value"] += value
                
                total_value += value
                weighted_value += value * (prob / 100)
            except Exception as e:
                logger.error(f"Error parsing stats for record: {record}. Error: {e}")
                continue
        
        return {
            "total_opportunities": len(records),
            "total_value": total_value,
            "weighted_value": weighted_value,
            "by_stage": stages
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
