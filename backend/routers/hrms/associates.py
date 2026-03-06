import logging
import traceback
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List
from services.google_sheets import sheets_service
from utils.logging_utils import trace_exceptions_async
from services.google_drive import drive_service
from models.hrms.associate import (
    Associate, AssociateCreate, AssociateUpdate,
    associate_to_row, row_to_associate
)
from config import settings
from middleware.auth_middleware import get_current_user, TokenData

logger = logging.getLogger("chrms.associates")

DRIVE_SUBFOLDERS = [
    "Letters",
    "ID Card",
    "Identity Documents",
    "Certificates",
    "Previous Employment Documents",
    "Photo",
    "Payslips"
]

router = APIRouter()


def generate_associate_id():
    """Generate next sequential associate ID in format 100001, 100002, etc."""
    try:
        records = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
        if not records:
            return "100001"
        
        max_seq = 100000
        for record in records:
            aid = str(record.get("Associate ID", "")).strip()
            try:
                seq = int(aid)
                if seq >= 100001:
                    max_seq = max(max_seq, seq)
            except ValueError:
                continue
        
        return str(max_seq + 1)
    except Exception as e:
        logger.error(f"Error generating associate ID: {e}")
        return "100001"

@router.get("/", response_model=List[Associate])
@trace_exceptions_async
async def get_associates(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get associates.
    - Admins/HR see all.
    - Others see themselves, their ancestors (path to top), and all their descendants.
    - Normalizes 'manager_id' from Name to ID if necessary.
    """
    records = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
    all_associates = [row_to_associate(r) for r in records if r.get("Associate ID")]
    
    # Create lookup maps for normalization and efficient filtering
    id_map = {str(a.associate_id).strip().lower(): a for a in all_associates}
    name_map = {str(a.associate_name).strip().lower(): str(a.associate_id).strip() for a in all_associates if a.associate_name}
    
    # Normalize manager_id: If it's a name, resolve it to an ID
    for assoc in all_associates:
        m_ref = str(assoc.manager_id or "").strip()
        m_ref_lower = m_ref.lower()
        
        # If it's not already a valid ID in our id_map, try matching by name
        if m_ref_lower and m_ref_lower not in id_map:
            if m_ref_lower in name_map:
                assoc.manager_id = name_map[m_ref_lower]
                # logger.info(f"Resolved manager name '{m_ref}' to ID '{assoc.manager_id}' for {assoc.associate_id}")

    # RBAC Filtering - Admins, HR, and Operations Managers see everything
    if current_user.role.lower() in ["admin", "hr", "operations manager"]:
        return all_associates
    
    user_id = str(current_user.associate_id).strip().lower()
    if user_id not in id_map:
        logger.warning(f"User ID {user_id} not found in associate records.")
        return []

    # Filter hierarchy: find ancestors and descendants
    result_ids = {user_id}
    
    # 1. Ancestors
    curr_id = user_id
    while curr_id in id_map:
        manager_id = str(id_map[curr_id].manager_id or "").strip().lower()
        if not manager_id or manager_id == curr_id or manager_id in result_ids:
            break
        result_ids.add(manager_id)
        curr_id = manager_id
        
    # 2. Descendants (recursive)
    def add_descendants(parent_id):
        for aid, assoc in id_map.items():
            if str(assoc.manager_id or "").strip().lower() == parent_id:
                if aid not in result_ids:
                    result_ids.add(aid)
                    add_descendants(aid)
                    
    add_descendants(user_id)
    
    filtered = [a for a in all_associates if str(a.associate_id).strip().lower() in result_ids]
    logger.info(f"DEBUG: Hierarchy filtered count: {len(filtered)} out of {len(all_associates)} for user {user_id}")
    return filtered

@router.get("/next-id")
async def get_next_id():
    """Get the next available associate ID."""
    try:
        next_id = generate_associate_id()
        return {"next_id": next_id}
    except Exception as e:
        logger.error(f"Error getting next ID: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{associate_id}", response_model=Associate)
async def get_associate(associate_id: str):
    """Get a single associate by ID."""
    try:
        record = sheets_service.get_row_by_id(
            settings.ASSOCIATES_SHEET, "Associate ID", associate_id
        )
        if not record:
            raise HTTPException(status_code=404, detail="Associate not found")
        return row_to_associate(record)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching associate {associate_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=dict)
async def create_associate(associate: AssociateCreate):
    """Create a new associate with automatic ID generation and Google Drive folder provisioning."""
    try:
        # Auto-generate ID if not provided
        if not associate.associate_id:
            associate.associate_id = generate_associate_id()
        
        # Check if ID already exists
        existing = sheets_service.get_row_by_id(
            settings.ASSOCIATES_SHEET, "Associate ID", associate.associate_id
        )
        if existing:
            raise HTTPException(status_code=400, detail="Associate ID already exists")
        
        # Create Google Drive folder structure if configured
        if settings.DRIVE_PEOPLES_FOLDER_ID:
            folder_name = f"{associate.associate_id} - {associate.associate_name}"
            parent_folder_id = drive_service.create_folder(
                folder_name, settings.DRIVE_PEOPLES_FOLDER_ID
            )
            if parent_folder_id:
                associate.drive_folder_id = parent_folder_id
                # Create sub-folders
                for subfolder in DRIVE_SUBFOLDERS:
                    drive_service.create_folder(subfolder, parent_folder_id)
                logger.info(f"Created Drive folder structure for {associate.associate_id}")
            else:
                logger.warning(f"Failed to create Drive folder for {associate.associate_id}")
        
        row = associate_to_row(associate)
        result = sheets_service.append_row(settings.ASSOCIATES_SHEET, row)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating associate: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{associate_id}", response_model=dict)
async def update_associate(associate_id: str, update: AssociateUpdate):
    """Update an existing associate."""
    try:
        row_index = sheets_service.find_row_index(
            settings.ASSOCIATES_SHEET, "Associate ID", associate_id
        )
        if not row_index:
            raise HTTPException(status_code=404, detail="Associate not found")
        
        # Get current data
        current = sheets_service.get_row_by_id(
            settings.ASSOCIATES_SHEET, "Associate ID", associate_id
        )
        current_associate = row_to_associate(current)
        
        # Merge updates
        update_data = update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(current_associate, key, value)
            
        # Backfill Drive Folder if missing and config is present
        if not current_associate.drive_folder_id and settings.DRIVE_PEOPLES_FOLDER_ID:
            try:
                folder_name = f"{associate_id} - {current_associate.associate_name}"
                parent_id = drive_service.create_folder(
                    folder_name, settings.DRIVE_PEOPLES_FOLDER_ID
                )
                if parent_id:
                    current_associate.drive_folder_id = parent_id
                    for subfolder in DRIVE_SUBFOLDERS:
                        drive_service.create_folder(subfolder, parent_id)
                    logger.info(f"Created missing Drive folder structure for {associate_id}")
            except Exception as e:
                logger.error(f"Failed to backfill drive folder for {associate_id}: {e}")
        
        # Create row from merged data
        merged = AssociateCreate(
            associate_id=associate_id,
            **current_associate.model_dump(exclude={"associate_id"})
        )
        row = associate_to_row(merged)
        
        result = sheets_service.update_row(settings.ASSOCIATES_SHEET, row_index, row)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating associate {associate_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{associate_id}", response_model=dict)
async def delete_associate(associate_id: str):
    """Delete an associate."""
    try:
        row_index = sheets_service.find_row_index(
            settings.ASSOCIATES_SHEET, "Associate ID", associate_id
        )
        if not row_index:
            raise HTTPException(status_code=404, detail="Associate not found")
        
        result = sheets_service.delete_row(settings.ASSOCIATES_SHEET, row_index)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting associate {associate_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{associate_id}/upload-proof")
async def upload_proof(
    associate_id: str,
    proof_type: str = Form(...),  # "national_id", "tax_id", "passport", "photo"
    file: UploadFile = File(...)
):
    """Upload proof document or photo to associate's Drive folder."""
    try:
        # Get the associate
        record = sheets_service.get_row_by_id(
            settings.ASSOCIATES_SHEET, "Associate ID", associate_id
        )
        if not record:
            raise HTTPException(status_code=404, detail="Associate not found")
        
        associate = row_to_associate(record)
        
        if not associate.drive_folder_id:
            if not settings.DRIVE_PEOPLES_FOLDER_ID:
                raise HTTPException(
                    status_code=500,
                    detail="System Configuration Error: DRIVE_PEOPLES_FOLDER_ID is not set in .env. Cannot upload proofs."
                )
            
            raise HTTPException(
                status_code=400,
                detail="Associate does not have a Drive folder linked. Please try editing and saving the associate again to generate one."
            )
        
        # Determine target folder name based on proof type
        target_folder_name = "Identity Documents"
        if proof_type == "photo":
            target_folder_name = "Photo"
        
        # Find the target sub-folder
        try:
            results = drive_service._service.files().list(
                q=f"'{associate.drive_folder_id}' in parents and name='{target_folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields='files(id)',
                supportsAllDrives=True,
                includeItemsFromAllDrives=True
            ).execute()
            files = results.get('files', [])
            if files:
                target_folder_id = files[0]['id']
            else:
                # Create it if it doesn't exist
                target_folder_id = drive_service.create_folder(
                    target_folder_name, associate.drive_folder_id
                )
        except Exception:
            # Fallback to parent folder if search fails
            target_folder_id = associate.drive_folder_id
        
        # Read file content
        file_bytes = await file.read()
        filename = f"{associate_id}_{proof_type}_{file.filename}"
        
        # Upload to Drive
        file_id = drive_service.upload_file_binary(
            file_bytes, filename, file.content_type or "application/octet-stream",
            target_folder_id
        )
        
        if not file_id:
            raise HTTPException(status_code=500, detail="Failed to upload file to Drive")
        
        # If it's a photo, make it public for everyone with the link
        if proof_type == "photo":
            drive_service.make_public_reader(file_id)
        
        drive_link = f"https://drive.google.com/file/d/{file_id}/view"
        
        # Update the proof field in the sheet
        row_index = sheets_service.find_row_index(
            settings.ASSOCIATES_SHEET, "Associate ID", associate_id
        )
        if row_index:
            current = sheets_service.get_row_by_id(
                settings.ASSOCIATES_SHEET, "Associate ID", associate_id
            )
            current_associate = row_to_associate(current)
            
            if proof_type == "national_id":
                current_associate.national_id_proof = drive_link
            elif proof_type == "tax_id":
                current_associate.tax_id_proof = drive_link
            elif proof_type == "passport":
                current_associate.passport_proof = drive_link
            elif proof_type == "photo":
                current_associate.photo = drive_link
            else:
                raise HTTPException(status_code=400, detail="Invalid proof_type. Use 'national_id', 'tax_id', 'passport', or 'photo'.")
            
            merged = AssociateCreate(
                associate_id=associate_id,
                **current_associate.model_dump(exclude={"associate_id"})
            )
            row = associate_to_row(merged)
            sheets_service.update_row(settings.ASSOCIATES_SHEET, row_index, row)
        
        return {"success": True, "file_id": file_id, "drive_link": drive_link}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading proof for {associate_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/department/{department}", response_model=List[Associate])
async def get_associates_by_department(department: str):
    """Get associates filtered by department."""
    try:
        records = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
        filtered = [
            row_to_associate(r) for r in records
            if r.get("Associate ID") and r.get("Department", "").lower() == department.lower()
        ]
        return filtered
    except Exception as e:
        logger.error(f"Error fetching associates by department {department}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
