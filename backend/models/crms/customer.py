from pydantic import BaseModel
from typing import Optional

class CustomerBase(BaseModel):
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    onboarding_date: Optional[str] = None
    mutual_nda: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str
    contact_person: str
    email: str
    phone: Optional[str] = None
    address: str
    city: str
    state: str
    zip_code: str
    country: str
    currency: str
    mutual_nda: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    onboarding_date: Optional[str] = None
    mutual_nda: Optional[str] = None

class Customer(CustomerBase):
    id: str
