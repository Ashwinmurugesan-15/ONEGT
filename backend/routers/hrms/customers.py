from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime
from services.google_sheets import sheets_service
from models.hrms.customer import (
    Customer, CustomerCreate, CustomerUpdate,
    customer_to_row, row_to_customer, CUSTOMER_COLUMNS
)
from config import settings
from utils.logging_utils import trace_exceptions_async

router = APIRouter()

@router.get("/", response_model=List[Customer])
@trace_exceptions_async
async def get_customers():
    """Get all customers from CRMS spreadsheet."""
    records = sheets_service.get_crms_all_records(settings.CRMS_CUSTOMERS_SHEET)
    return [row_to_customer(r) for r in records if r.get("Customer ID")]

@router.get("/{customer_id}", response_model=Customer)
@trace_exceptions_async
async def get_customer(customer_id: str):
    """Get a single customer by ID from CRMS spreadsheet."""
    record = sheets_service.crms_get_row_by_id(
        settings.CRMS_CUSTOMERS_SHEET, "Customer ID", customer_id
    )
    if not record:
        raise HTTPException(status_code=404, detail="Customer not found")
    return row_to_customer(record)

@router.post("/", response_model=dict)
@trace_exceptions_async
async def create_customer(customer: CustomerCreate):
    """Create a new customer in CRMS spreadsheet."""
    existing = sheets_service.crms_get_row_by_id(
        settings.CRMS_CUSTOMERS_SHEET, "Customer ID", customer.customer_id
    )
    if existing:
        raise HTTPException(status_code=400, detail="Customer ID already exists")
    
    row = customer_to_row(customer, is_new=True)
    # The CRMS sheet has a slightly different layout (City, State, Zip after Address)
    # But row_to_customer uses record.get, which is safer.
    # However, create/update uses raw lists usually. 
    # Let's check the CRMS column structure again.
    # HRMS Customer Model: ID, Name, Contact, Email, Phone, Address, Country, Currency, Status, Onboarding, NDA
    # CRMS Customer Sheet: ID, Name, Contact, Email, Phone, Address, City, State, Zip, Country, Currency, Status, Onboarding, NDA
    # I should adjust the HRMS customer_to_row to handle these extra columns if I'm writing back.
    # OR, since the user moved it to CRMS, maybe HRMS should only be READ or use a compatible writer.
    
    # Actually, the user says "you can pull from there". Let's assume write is also needed.
    # I'll update row_to_customer to be more flexible or just use the CRMS structure.
    
    # Wait, the HRMS Customer model doesn't have City, State, Zip.
    # If I use HRMS Customer model to write to CRMS sheet, I'll miss those 3 columns.
    
    # Let's see models/hrms/customer.py again.
    # customer_to_row generates a list.
    
    # For now, let's just use the current HRMS create_customer logic but point to CRMS.
    # If the CRMS sheet has more columns, the append_row might misalign if it's strictly index based.
    # CRMS append_row in google_sheets.py: sheet.append_row(values, value_input_option='USER_ENTERED')
    # If values has 11 elements and sheet has 14, it will fill first 11. 
    # But CRMS sheet has Country after Address, City, State, Zip.
    # So Country will end up in City column.
    
    # I need to update hrms models to be compatible or manually adjust the row list here.
    
    # Let's adjust the row in the router to match CRMS sheet headers:
    # 0:ID, 1:Name, 2:Contact, 3:Email, 4:Phone, 5:Address, 6:City, 7:State, 8:Zip, 9:Country, 10:Currency, 11:Status, 12:Onboarding, 13:NDA
    
    onboarding_date = customer.onboarding_date or datetime.now().strftime("%d-%b-%Y %H:%M:%S")
    values = [
        customer.customer_id,
        customer.customer_name,
        customer.contact_person or "",
        customer.email or "",
        customer.phone or "",
        customer.address or "",
        "", # City
        "", # State
        "", # Zip
        customer.country or "",
        customer.currency,
        customer.status,
        onboarding_date,
        customer.mutual_nda or ""
    ]
    
    result = sheets_service.crms_append_row(settings.CRMS_CUSTOMERS_SHEET, values)
    return result

@router.put("/{customer_id}", response_model=dict)
@trace_exceptions_async
async def update_customer(customer_id: str, update: CustomerUpdate):
    """Update an existing customer in CRMS spreadsheet."""
    row_index = sheets_service.crms_find_row_index(
        settings.CRMS_CUSTOMERS_SHEET, "Customer ID", customer_id
    )
    if not row_index:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    current = sheets_service.crms_get_row_by_id(
        settings.CRMS_CUSTOMERS_SHEET, "Customer ID", customer_id
    )
    
    # Merge updates
    updated_name = update.customer_name if update.customer_name is not None else current.get("Customer Name", "")
    updated_contact = update.contact_person if update.contact_person is not None else current.get("Contact Person", "")
    updated_email = update.email if update.email is not None else current.get("Email", "")
    updated_phone = update.phone if update.phone is not None else current.get("Phone", "")
    updated_address = update.address if update.address is not None else current.get("Address", "")
    updated_country = update.country if update.country is not None else current.get("Country", "")
    updated_currency = update.currency if update.currency is not None else current.get("Currency", "")
    updated_status = update.status if update.status is not None else current.get("Status", "")
    updated_nda = update.mutual_nda if update.mutual_nda is not None else current.get("Mutual NDA", "")
    
    # Keep existing CRMS specific fields
    updated_city = current.get("City", "")
    updated_state = current.get("State", "")
    updated_zip = current.get("Zip", "")
    onboarding_date = current.get("Onboarding Date", "")
    
    values = [
        customer_id,
        updated_name,
        updated_contact,
        updated_email,
        updated_phone,
        updated_address,
        updated_city,
        updated_state,
        updated_zip,
        updated_country,
        updated_currency,
        updated_status,
        onboarding_date,
        updated_nda
    ]
    
    result = sheets_service.crms_update_row(settings.CRMS_CUSTOMERS_SHEET, row_index, values)
    return result

@router.delete("/{customer_id}", response_model=dict)
@trace_exceptions_async
async def delete_customer(customer_id: str):
    """Delete a customer from CRMS spreadsheet."""
    row_index = sheets_service.crms_find_row_index(
        settings.CRMS_CUSTOMERS_SHEET, "Customer ID", customer_id
    )
    if not row_index:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    result = sheets_service.crms_delete_row(settings.CRMS_CUSTOMERS_SHEET, row_index)
    return result

@router.get("/status/{status}", response_model=List[Customer])
@trace_exceptions_async
async def get_customers_by_status(status: str):
    """Get customers filtered by status from CRMS spreadsheet."""
    records = sheets_service.get_crms_all_records(settings.CRMS_CUSTOMERS_SHEET)
    filtered = [
        row_to_customer(r) for r in records
        if r.get("Customer ID") and r.get("Status", "").lower() == status.lower()
    ]
    return filtered
