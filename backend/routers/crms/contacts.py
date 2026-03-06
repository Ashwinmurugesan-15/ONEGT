from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import logging
import traceback
import uuid

from models.crms.contact import Contact, ContactCreate, ContactUpdate
from services.google_sheets import sheets_service
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crms/contacts", tags=["CRMS - Contacts"])

SHEET_NAME = settings.CRMS_CONTACTS_SHEET
ID_COLUMN = "Contact ID"


def generate_contact_id():
    """Generate a unique contact ID in format GTCTXXXXXX."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        max_id = 0
        for record in records:
            contact_id = str(record.get("Contact ID", ""))
            if contact_id.startswith("GTCT"):
                try:
                    num_part = int(contact_id[4:])
                    if num_part > max_id:
                        max_id = num_part
                except ValueError:
                    continue
        
        next_id = max_id + 1
        return f"GTCT{next_id:06d}"
    except Exception as e:
        logger.error(f"Error generating contact ID: {e}")
        return f"GTCT-{uuid.uuid4().hex[:6].upper()}"


@router.get("", response_model=List[Contact])
async def get_contacts(customer_id: Optional[str] = None):
    """Get all contacts with optional customer filter."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        contacts = []
        
        for record in records:
            try:
                # Map Company to customer_id logic if needed, but here we filter by ID
                # If sheet has "Company" (ID), we check that.
                if customer_id and str(record.get("Company", "") or record.get("Customer ID", "")) != customer_id:
                    continue
                
                contacts.append(Contact(
                    id=str(record.get("Contact ID", "")),
                    customer_id=str(record.get("Company", "") or record.get("Customer ID", "") or record.get("Company Name", "") or ""), # Map Company -> customer_id
                    first_name=record.get("First Name", ""),
                    last_name=record.get("Last Name", ""),
                    email=record.get("Email", ""),
                    phone=str(record.get("Phone", "") or ""),
                    title=record.get("Title", ""),
                    department=record.get("Department", ""),
                    location=record.get("Location", ""),
                    country=record.get("Country", ""),
                    created_on=record.get("Created On", "") or record.get("Created At", "") or None,
                    updated_on=record.get("Updated On", "") or record.get("Updated At", "") or None
                ))
            except Exception as e:
                logger.error(f"Error parsing contact record: {record}. Error: {e}")
                continue

        return contacts
    except Exception as e:
        logger.error(f"Error in get_contacts: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{contact_id}", response_model=Contact)
async def get_contact(contact_id: str):
    """Get a single contact by ID."""
    try:
        record = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, contact_id)
        if not record:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        return Contact(
            id=str(record.get("Contact ID", "")),
            customer_id=str(record.get("Company", "") or record.get("Customer ID", "") or record.get("Company Name", "") or ""),
            first_name=record.get("First Name", ""),
            last_name=record.get("Last Name", ""),
            email=record.get("Email", ""),
            phone=str(record.get("Phone", "") or ""),
            title=record.get("Title", ""),
            department=record.get("Department", ""),
            location=record.get("Location", ""),
            country=record.get("Country", ""),
            created_on=record.get("Created On", "") or record.get("Created At", "") or None,
            updated_on=record.get("Updated On", "") or record.get("Updated At", "") or None
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_contact: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Contact)
async def create_contact(contact: ContactCreate):
    """Create a new contact."""
    try:
        contact_id = generate_contact_id()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Headers: Contact ID, First Name, Last Name, Email, Phone, Company, Title, Department, Created On, Updated On
        values = [
            contact_id,
            contact.first_name,
            contact.last_name,
            contact.email,
            contact.phone,
            contact.customer_id, # Maps to Company
            contact.location,
            contact.country,
            contact.title,
            contact.department,
            now, # Created On
            now  # Updated On
        ]
        
        sheets_service.crms_append_row(SHEET_NAME, values)
        
        return Contact(
            id=contact_id,
            customer_id=contact.customer_id,
            first_name=contact.first_name,
            last_name=contact.last_name,
            email=contact.email,
            phone=contact.phone,
            title=contact.title,
            department=contact.department,
            created_on=now,
            updated_on=now
        )
    except Exception as e:
        logger.error(f"Error creating contact: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{contact_id}", response_model=Contact)
async def update_contact(contact_id: str, update: ContactUpdate):
    """Update an existing contact."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, contact_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        existing = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, contact_id)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Headers: Contact ID, First Name, Last Name, Email, Phone, Company, Title, Department, Created On, Updated On
        
        values = [
            contact_id,
            update.first_name if update.first_name is not None else existing.get("First Name", ""),
            update.last_name if update.last_name is not None else existing.get("Last Name", ""),
            update.email if update.email is not None else existing.get("Email", ""),
            update.phone if update.phone is not None else str(existing.get("Phone", "") or ""),
            update.customer_id if update.customer_id is not None else str(existing.get("Company", "") or existing.get("Customer ID", "") or ""),
            update.location if update.location is not None else existing.get("Location", ""),
            update.country if update.country is not None else existing.get("Country", ""),
            update.title if update.title is not None else existing.get("Title", ""),
            update.department if update.department is not None else existing.get("Department", ""),
            existing.get("Created On") or existing.get("Created At", ""),
            now
        ]
        
        sheets_service.crms_update_row(SHEET_NAME, row_index, values)
        
        return Contact(
            id=contact_id,
            first_name=values[1],
            last_name=values[2],
            email=values[3],
            phone=values[4],
            customer_id=values[5],
            title=values[6],
            department=values[7],
            created_on=values[8],
            updated_on=now
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating contact: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{contact_id}")
async def delete_contact(contact_id: str):
    """Delete a contact."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, contact_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        sheets_service.crms_delete_row(SHEET_NAME, row_index)
        return {"success": True, "message": "Contact deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting contact: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
