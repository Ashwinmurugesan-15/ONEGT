from pydantic import BaseModel
from typing import Optional, List, Dict

class InvoiceItem(BaseModel):
    description: str
    quantity: float
    price: float
    amount: float

class InvoiceBase(BaseModel):
    deal_id: Optional[str] = None
    customer_id: str
    invoice_number: str
    issue_date: str
    due_date: str
    status: str = "Draft"
    template_id: Optional[str] = None
    items: List[InvoiceItem] = []
    notes: Optional[str] = None
    currency: str = "USD"
    tax_rate: float = 0
    discount: float = 0
    total_amount: float = 0
    payment_date: Optional[str] = None
    credit_currency: Optional[str] = None
    credited_amount: Optional[float] = None

class InvoiceCreate(InvoiceBase):
    pass

class BulkGenerateRequest(BaseModel):
    deal_ids: List[str]
    month_year: str  # Format: "Mon-YYYY"

class InvoiceUpdate(BaseModel):
    deal_id: Optional[str] = None
    customer_id: Optional[str] = None
    invoice_number: Optional[str] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    template_id: Optional[str] = None
    items: Optional[List[InvoiceItem]] = None
    notes: Optional[str] = None
    currency: Optional[str] = None
    tax_rate: Optional[float] = None
    discount: Optional[float] = None
    total_amount: Optional[float] = None
    payment_date: Optional[str] = None
    credit_currency: Optional[str] = None
    credited_amount: Optional[float] = None

class Invoice(InvoiceBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
