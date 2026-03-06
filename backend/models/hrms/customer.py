from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CustomerBase(BaseModel):
    customer_name: str
    contact_person: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    country: Optional[str] = ""
    currency: str = "USD"
    status: str = "Active"
    onboarding_date: Optional[str] = ""  # Auto-set on creation if empty
    mutual_nda: Optional[str] = ""  # Google Drive URL

class CustomerCreate(CustomerBase):
    customer_id: str

class CustomerUpdate(BaseModel):
    customer_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    onboarding_date: Optional[str] = None
    mutual_nda: Optional[str] = None

class Customer(CustomerBase):
    customer_id: str
    
    class Config:
        from_attributes = True

# Column mapping - matches the Google Sheet headers
CUSTOMER_COLUMNS = [
    "Customer ID",
    "Customer Name",
    "Contact Person",
    "Email",
    "Phone",
    "Address",
    "Country",
    "Currency",
    "Status",
    "Onboarding Date",
    "Mutual NDA"
]

def get_current_timestamp() -> str:
    """Get current timestamp in dd-mmm-yyyy hh:MM:ss format."""
    return datetime.now().strftime("%d-%b-%Y %H:%M:%S")

def customer_to_row(customer: CustomerCreate, is_new: bool = True) -> list:
    # Auto-set onboarding_date for new customers if not provided
    onboarding_date = customer.onboarding_date
    if is_new and not onboarding_date:
        onboarding_date = get_current_timestamp()
    
    return [
        customer.customer_id,
        customer.customer_name,
        customer.contact_person or "",
        customer.email or "",
        customer.phone or "",
        customer.address or "",
        customer.country or "",
        customer.currency,
        customer.status,
        onboarding_date or "",
        customer.mutual_nda or ""
    ]

def row_to_customer(record: dict) -> Customer:
    return Customer(
        customer_id=str(record.get("Customer ID", "")),
        customer_name=str(record.get("Customer Name", "")),
        contact_person=str(record.get("Contact Person", "")),
        email=str(record.get("Email", "")),
        phone=str(record.get("Phone", "")),
        address=str(record.get("Address", "")),
        country=str(record.get("Country", "")),
        currency=str(record.get("Currency", "USD")),
        status=str(record.get("Status", "Active")),
        onboarding_date=str(record.get("Onboarding Date", "")),
        mutual_nda=str(record.get("Mutual NDA", ""))
    )
