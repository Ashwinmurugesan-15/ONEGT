from pydantic import BaseModel
from typing import Optional
from enum import Enum

class ProjectType(str, Enum):
    REVENUE = "Revenue"
    INVESTMENT = "Investment"

class ProjectStatus(str, Enum):
    ACTIVE = "Active"
    COMPLETED = "Completed"
    ON_HOLD = "On Hold"
    CANCELLED = "Cancelled"

class ProjectBase(BaseModel):
    project_name: str
    customer_id: Optional[str] = ""
    project_type: str  # Type column
    status: str
    start_date: str
    end_date: Optional[str] = ""
    deal_id: Optional[str] = ""
    project_manager_id: Optional[str] = ""  # Associate ID

class ProjectCreate(ProjectBase):
    project_id: str

class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    customer_id: Optional[str] = None
    project_type: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    deal_id: Optional[str] = None
    project_manager_id: Optional[str] = None

class Project(ProjectBase):
    project_id: str
    
    class Config:
        from_attributes = True

PROJECT_COLUMNS = [
    "Project ID",
    "Project Name",
    "Customer ID",
    "Deal ID",
    "Type",
    "Status",
    "Start Date",
    "End Date",
    "Project Manager ID"
]

from utils.date_utils import format_date_for_sheet, parse_date_from_sheet

def project_to_row(project: ProjectCreate) -> list:
    return [
        project.project_id,
        project.project_name,
        project.customer_id or "",
        project.deal_id or "",
        project.project_type,
        project.status,
        format_date_for_sheet(project.start_date),
        format_date_for_sheet(project.end_date) if project.end_date else "",
        project.project_manager_id or ""
    ]

def row_to_project(record: dict) -> Project:
    return Project(
        project_id=str(record.get("Project ID", "")),
        project_name=str(record.get("Project Name", "")),
        customer_id=str(record.get("Customer ID", "")),
        deal_id=str(record.get("Deal ID", "")),
        project_type=str(record.get("Type", "")),
        status=str(record.get("Status", "")),
        start_date=parse_date_from_sheet(str(record.get("Start Date", "") or "")),
        end_date=parse_date_from_sheet(str(record.get("End Date", "") or "")),
        project_manager_id=str(record.get("Project Manager ID", ""))
    )
