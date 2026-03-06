from pydantic import BaseModel
from typing import Optional
from enum import Enum

class AllocationType(str, Enum):
    BILLABLE = "Billable"
    NON_BILLABLE = "Non Billable"

class AllocationBase(BaseModel):
    project_id: str
    project_name: str
    project_status: Optional[str] = None
    associate_id: str
    associate_name: str
    allocation_type: str
    start_date: str
    end_date: Optional[str] = ""
    allocation_percentage: float = 100

class AllocationCreate(AllocationBase):
    project_name: Optional[str] = None
    associate_name: Optional[str] = None

class AllocationUpdate(BaseModel):
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    associate_id: Optional[str] = None
    associate_name: Optional[str] = None
    allocation_type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    allocation_percentage: Optional[float] = None

class Allocation(AllocationBase):
    row_index: Optional[int] = None
    
    class Config:
        from_attributes = True

# Column mapping
ALLOCATION_COLUMNS = [
    "Project ID",
    "Associate ID",
    "Allocation Type",
    "Allocation Start Date",
    "Allocation End Date",
    "Allocation %"
]

from utils.date_utils import format_date_for_sheet, parse_date_from_sheet

def allocation_to_row(allocation: AllocationCreate) -> list:
    return [
        allocation.project_id,
        allocation.associate_id,
        allocation.allocation_type,
        format_date_for_sheet(allocation.start_date),
        format_date_for_sheet(allocation.end_date) if allocation.end_date else "",
        allocation.allocation_percentage
    ]

def row_to_allocation(record: dict, row_index: int = None) -> Allocation:
    start_date = parse_date_from_sheet(record.get("Allocation Start Date") or record.get("Start Date") or "")
    end_date = parse_date_from_sheet(record.get("Allocation End Date") or record.get("End Date") or "")

    return Allocation(
        project_id=str(record.get("Project ID", "")),
        project_name=str(record.get("Project Name", "")),
        project_status=str(record.get("Project Status", "")),
        associate_id=str(record.get("Associate ID", "")),
        associate_name=str(record.get("Associate Name", "")),
        allocation_type=str(record.get("Allocation Type", "")),
        start_date=str(start_date),
        end_date=str(end_date),
        allocation_percentage=float(record.get("Allocation %", 100) or 100),
        row_index=row_index
    )
