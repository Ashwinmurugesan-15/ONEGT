from pydantic import BaseModel
from typing import Optional, List
from .invoice import Invoice

class DealBase(BaseModel):
    customer_id: Optional[str] = None
    name: str
    value: float = 0.0
    currency: str = "USD"
    stage: str = "Prospecting"
    close_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    owner_id: Optional[str] = None
    notes: Optional[str] = None
    sow_number: Optional[str] = None
    sow: Optional[str] = None
    po_number: Optional[str] = None

class DealCreate(DealBase):
    pass

class DealUpdate(BaseModel):
    customer_id: Optional[str] = None
    name: Optional[str] = None
    value: Optional[float] = None
    currency: Optional[str] = None
    stage: Optional[str] = None
    close_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    owner_id: Optional[str] = None
    notes: Optional[str] = None
    sow_number: Optional[str] = None
    sow: Optional[str] = None
    po_number: Optional[str] = None

class Deal(DealBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class DealFinanceView(Deal):
    invoices: List[Invoice] = []
