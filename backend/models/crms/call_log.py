from pydantic import BaseModel
from typing import Optional

class CallLogBase(BaseModel):
    contact_id: str
    direction: str = "Outbound"
    duration: int
    outcome: str
    notes: str
    call_date: str

class CallLogCreate(CallLogBase):
    pass

class CallLogUpdate(BaseModel):
    contact_id: Optional[str] = None
    direction: Optional[str] = None
    duration: Optional[int] = None
    outcome: Optional[str] = None
    notes: Optional[str] = None
    call_date: Optional[str] = None

class CallLog(CallLogBase):
    id: str
    created_by: Optional[str] = None
    created_at: Optional[str] = None
