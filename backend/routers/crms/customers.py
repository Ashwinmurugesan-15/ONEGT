from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import logging
import traceback

from models.crms.customer import Customer, CustomerCreate, CustomerUpdate
from services.google_sheets import sheets_service
from config import settings
from utils.logging_utils import trace_exceptions_async

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crms/customers", tags=["CRMS - Customers"])

SHEET_NAME = settings.CRMS_CUSTOMERS_SHEET
ID_COLUMN = "Customer ID"


def generate_customer_id():
    """Generate sequential customer ID in format C00001, C00002, etc."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        if not records:
            return "C00001"
        
        # Extract all existing IDs and find the max sequence
        max_seq = 0
        for record in records:
            cust_id = str(record.get("Customer ID", ""))
            if cust_id.startswith("C") and len(cust_id) == 6:
                try:
                    seq = int(cust_id[1:])
                    max_seq = max(max_seq, seq)
                except ValueError:
                    continue
        
        return f"C{(max_seq + 1):05d}"
    except Exception as e:
        logger.error(f"Error generating customer ID: {str(e)}")
        return f"C00001"


def get_current_timestamp():
    """Get current timestamp in dd-MMM-yyyy HH:MM:SS format."""
    return datetime.now().strftime("%d-%b-%Y %H:%M:%S")


@router.get("", response_model=List[Customer])
@trace_exceptions_async
async def get_customers(
    status: Optional[str] = None,
    country: Optional[str] = None
):
    """Get all customers with optional filters."""
    records = sheets_service.get_crms_all_records(SHEET_NAME)
    customers = []
    
    for record in records:
        # Apply filters
        if status and record.get("Status", "") != status:
            continue
        if country and record.get("Country", "") != country:
            continue
        
        customers.append(Customer(
            id=str(record.get("Customer ID", "")),
            name=record.get("Customer Name", ""),
            contact_person=record.get("Contact Person", "") or None,
            email=record.get("Email", "") or None,
            phone=str(record.get("Phone", "")) if record.get("Phone") else None,
            address=record.get("Address", "") or None,
            city=record.get("City", "") or None,
            state=record.get("State", "") or None,
            zip_code=str(record.get("Zip", "")) if record.get("Zip") else None,
            country=record.get("Country", "") or None,
            currency=record.get("Currency", "") or None,
            status=record.get("Status", "") or None,
            onboarding_date=record.get("Onboarding Date", "") or None,
            mutual_nda=record.get("Mutual NDA", "") or None
        ))
    
    return customers


@router.get("/{customer_id}", response_model=Customer)
@trace_exceptions_async
async def get_customer(customer_id: str):
    """Get a single customer by ID."""
    record = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, customer_id)
    if not record:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return Customer(
        id=str(record.get("Customer ID", "")),
        name=record.get("Customer Name", ""),
        contact_person=record.get("Contact Person", "") or None,
        email=record.get("Email", "") or None,
        phone=str(record.get("Phone", "")) if record.get("Phone") else None,
        address=record.get("Address", "") or None,
        city=record.get("City", "") or None,
        state=record.get("State", "") or None,
        zip_code=str(record.get("Zip", "")) if record.get("Zip") else None,
        country=record.get("Country", "") or None,
        currency=record.get("Currency", "") or None,
        status=record.get("Status", "") or None,
        onboarding_date=record.get("Onboarding Date", "") or None,
        mutual_nda=record.get("Mutual NDA", "") or None
    )


@router.post("", response_model=Customer)
async def create_customer(customer: CustomerCreate):
    """Create a new customer with auto-generated ID, status='Active', and current timestamp."""
    try:
        customer_id = generate_customer_id()
        onboarding_date = get_current_timestamp()
        status = "Active"  # Auto-set status to Active for new customers
        
        # Sheet columns: Customer ID, Customer Name, Contact Person, Email, Phone, 
        # Address, City, State, Zip, Country, Currency, Status, Onboarding Date, Mutual NDA
        values = [
            customer_id,
            customer.name,
            customer.contact_person,
            customer.email,
            customer.phone or "",
            customer.address,
            customer.city or "",
            customer.state or "",
            customer.zip_code or "",
            customer.country,
            customer.currency,
            status,
            onboarding_date,
            customer.mutual_nda or ""
        ]
        
        sheets_service.crms_append_row(SHEET_NAME, values)
        
        return Customer(
            id=customer_id,
            name=customer.name,
            contact_person=customer.contact_person,
            email=customer.email,
            phone=customer.phone,
            address=customer.address,
            city=customer.city,
            state=customer.state,
            zip_code=customer.zip_code,
            country=customer.country,
            currency=customer.currency,
            status=status,
            onboarding_date=onboarding_date,
            mutual_nda=customer.mutual_nda
        )
    except Exception as e:
        logger.error(f"Error in create_customer: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_update: CustomerUpdate):
    """Update an existing customer."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, customer_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        existing = sheets_service.crms_get_row_by_id(SHEET_NAME, ID_COLUMN, customer_id)
        
        values = [
            customer_id,
            customer_update.name if customer_update.name is not None else existing.get("Customer Name", ""),
            customer_update.contact_person if customer_update.contact_person is not None else existing.get("Contact Person", ""),
            customer_update.email if customer_update.email is not None else existing.get("Email", ""),
            customer_update.phone if customer_update.phone is not None else str(existing.get("Phone", "")) if existing.get("Phone") else "",
            customer_update.address if customer_update.address is not None else existing.get("Address", ""),
            customer_update.city if customer_update.city is not None else existing.get("City", ""),
            customer_update.state if customer_update.state is not None else existing.get("State", ""),
            customer_update.zip_code if customer_update.zip_code is not None else str(existing.get("Zip", "")) if existing.get("Zip") else "",
            customer_update.country if customer_update.country is not None else existing.get("Country", ""),
            customer_update.currency if customer_update.currency is not None else existing.get("Currency", ""),
            customer_update.status if customer_update.status is not None else existing.get("Status", ""),
            customer_update.onboarding_date if customer_update.onboarding_date is not None else existing.get("Onboarding Date", ""),
            customer_update.mutual_nda if customer_update.mutual_nda is not None else existing.get("Mutual NDA", "")
        ]
        
        sheets_service.crms_update_row(SHEET_NAME, row_index, values)
        
        return Customer(
            id=customer_id,
            name=values[1],
            contact_person=values[2] or None,
            email=values[3] or None,
            phone=str(values[4]) if values[4] else None,
            address=values[5] or None,
            city=values[6] or None,
            state=values[7] or None,
            zip_code=str(values[8]) if values[8] else None,
            country=values[9] or None,
            currency=values[10] or None,
            status=values[11] or None,
            onboarding_date=values[12] or None,
            mutual_nda=values[13] or None
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_customer: {str(e)}\\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str):
    """Delete a customer."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, ID_COLUMN, customer_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        sheets_service.crms_delete_row(SHEET_NAME, row_index)
        return {"success": True, "message": "Customer deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_customer: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
