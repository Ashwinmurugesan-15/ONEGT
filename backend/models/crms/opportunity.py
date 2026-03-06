from pydantic import BaseModel
from typing import Optional

class OpportunityBase(BaseModel):
    lead_id: Optional[str] = None
    name: str
    value: float = 0.0
    currency: str = "USD"
    stage: str = "Qualification"
    probability: int = 0
    expected_close: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None

class OpportunityCreate(OpportunityBase):
    pass

class OpportunityUpdate(BaseModel):
    lead_id: Optional[str] = None
    name: Optional[str] = None
    value: Optional[float] = None
    currency: Optional[str] = None
    stage: Optional[str] = None
    probability: Optional[int] = None
    expected_close: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None

class Opportunity(OpportunityBase):
    id: str
    created_on: Optional[str] = None
    updated_on: Optional[str] = None
