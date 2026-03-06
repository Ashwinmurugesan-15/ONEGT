from pydantic import BaseModel
from typing import Optional

class ContactBase(BaseModel):
    customer_id: str
    first_name: str
    last_name: str
    email: str
    phone: str
    title: str
    department: str
    location: Optional[str] = None
    country: Optional[str] = None

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    customer_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None

class Contact(ContactBase):
    id: str
    created_on: Optional[str] = None
    updated_on: Optional[str] = None
