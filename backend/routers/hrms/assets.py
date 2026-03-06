"""
Assets API router.
Handles asset management with role-based access.
- Admin/Manager: Full CRUD access
- Associate: Read-only access to their assigned assets
"""
import logging
import traceback
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from services.google_sheets import sheets_service
from models.hrms.asset import (
    Asset, AssetCreate, AssetUpdate,
    asset_to_row, row_to_asset, generate_asset_id,
    DEFAULT_ASSET_TYPES
)
from models.hrms.associate import row_to_associate # Needed to resolve reportees
from config import settings
from middleware.auth_middleware import get_current_user, TokenData

logger = logging.getLogger("chrms.assets")

router = APIRouter()


@router.get("/", response_model=List[Asset])
async def get_assets(
    owner: Optional[str] = Query(None, description="Filter by owner (Associate ID)"),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get all assets. 
    - Admins see all.
    - Managers see assets for themselves and their reportees.
    - Associates see only their own assets.
    """
    try:
        records = sheets_service.get_all_records(settings.ASSETS_SHEET)
        all_assets = [row_to_asset(r) for r in records if r.get("Asset ID")]
        
        # RBAC Filtering
        if current_user.role.lower() in ["admin", "hr", "operations manager"]:
            assets = all_assets
        else:
            # Need to find allowed owners (Self + Reportees)
            allowed_owners = {current_user.associate_id}
            
            if current_user.role.lower() == "manager":
                # Fetch associates to find reportees
                # Note: This might be slightly inefficient to read associates sheet here, 
                # but necessary for hierarchy check without a separate DB service.
                assoc_records = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
                for r in assoc_records:
                    if str(r.get("Manager ID", "")).strip() == current_user.associate_id:
                        if r.get("Associate ID"):
                            allowed_owners.add(str(r.get("Associate ID")))
            
            assets = [a for a in all_assets if a.owner in allowed_owners]
        
        if owner:
            assets = [a for a in assets if a.owner == owner]
        
        return assets
    except Exception as e:
        logger.error(f"Error fetching assets: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-assets/{associate_id}", response_model=List[Asset])
async def get_my_assets(associate_id: str):
    """Get assets assigned to a specific associate."""
    try:
        records = sheets_service.get_all_records(settings.ASSETS_SHEET)
        assets = [row_to_asset(r) for r in records if r.get("Asset ID")]
        
        # Filter by owner
        my_assets = [a for a in assets if a.owner == associate_id]
        return my_assets
    except Exception as e:
        logger.error(f"Error fetching assets for {associate_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/types", response_model=List[str])
async def get_asset_types():
    """Get list of unique asset types from existing assets + defaults."""
    try:
        records = sheets_service.get_all_records(settings.ASSETS_SHEET)
        types = list(DEFAULT_ASSET_TYPES)  # Start with defaults
        
        for record in records:
            asset_type = str(record.get("Asset Type", "") or "").strip()
            if asset_type and asset_type not in types:
                types.append(asset_type)
        
        return types
    except Exception as e:
        logger.error(f"Error fetching asset types: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{asset_id}", response_model=Asset)
async def get_asset(asset_id: str):
    """Get a specific asset by ID."""
    try:
        records = sheets_service.get_all_records(settings.ASSETS_SHEET)
        for record in records:
            if record.get("Asset ID") == asset_id:
                return row_to_asset(record)
        raise HTTPException(status_code=404, detail="Asset not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching asset {asset_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=Asset)
async def create_asset(asset: AssetCreate):
    """Create a new asset. Auto-generates Asset ID."""
    try:
        # Get existing assets to generate new ID
        records = sheets_service.get_all_records(settings.ASSETS_SHEET)
        existing_ids = [str(r.get("Asset ID", "")) for r in records if r.get("Asset ID")]
        
        # Generate new ID
        new_id = generate_asset_id(existing_ids)
        
        # Convert to row and append
        row = asset_to_row(asset, new_id)
        sheets_service.append_row(settings.ASSETS_SHEET, row)
        
        # Return the created asset
        return Asset(
            asset_id=new_id,
            **asset.model_dump()
        )
    except Exception as e:
        logger.error(f"Error creating asset: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{asset_id}", response_model=Asset)
async def update_asset(asset_id: str, asset_update: AssetUpdate):
    """Update an existing asset."""
    try:
        records = sheets_service.get_all_records(settings.ASSETS_SHEET)
        
        for idx, record in enumerate(records):
            if record.get("Asset ID") == asset_id:
                # Get existing asset
                existing = row_to_asset(record)
                
                # Merge updates
                update_data = asset_update.model_dump(exclude_unset=True)
                updated_dict = existing.model_dump()
                updated_dict.update(update_data)
                
                # Create updated asset
                updated = Asset(**updated_dict)
                
                # Update row (idx + 2 because of header and 1-indexed)
                row = [
                    updated.asset_id,
                    updated.asset_type,
                    updated.asset_name,
                    updated.serial_no,
                    updated.owner,
                    updated.username,
                    updated.model,
                    updated.color,
                    updated.processor,
                    updated.memory,
                    updated.disk,
                    updated.screen_type,
                    updated.other_spec,
                    updated.warranty_years,
                    updated.vendor,
                    updated.purchase_date,
                    updated.warranty_expiry,
                    updated.operating_system,
                    updated.client_onboarding_status,
                    updated.client_onboarding_software
                ]
                sheets_service.update_row(settings.ASSETS_SHEET, idx + 2, row)
                return updated
        
        raise HTTPException(status_code=404, detail="Asset not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating asset {asset_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str):
    """Delete an asset."""
    try:
        records = sheets_service.get_all_records(settings.ASSETS_SHEET)
        
        for idx, record in enumerate(records):
            if record.get("Asset ID") == asset_id:
                # Delete row (idx + 2 because of header and 1-indexed)
                sheets_service.delete_row(settings.ASSETS_SHEET, idx + 2)
                return {"message": f"Asset {asset_id} deleted"}
        
        raise HTTPException(status_code=404, detail="Asset not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting asset {asset_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
