import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

class TimesheetBase(BaseModel):
    timesheet_id: Optional[str] = None
    submitted_date: Optional[str] = None
    work_date: str
    associate_id: str
    project_id: str
    task: Optional[str] = ""
    hours: float = 0
    status: str = "Submitted"
    comments: Optional[str] = ""

class TimesheetCreate(TimesheetBase):
    pass

class TimesheetUpdate(BaseModel):
    work_date: Optional[str] = None
    task: Optional[str] = None
    hours: Optional[float] = None
    status: Optional[str] = None
    comments: Optional[str] = None

class TimesheetBulkStatusUpdate(BaseModel):
    row_indices: List[int]
    status: str
    reason: Optional[str] = None

class Timesheet(TimesheetBase):
    row_index: Optional[int] = None
    
    class Config:
        from_attributes = True

# Column mapping
TIMESHEET_COLUMNS = [
    "Timesheet ID",
    "Submitted Date",
    "Work Date",
    "Associate ID",
    "Project ID",
    "Task",
    "Hours",
    "Status",
    "Comments"
]

def timesheet_to_row(timesheet: TimesheetCreate) -> list:
    # Generate ID and Submitted Date if not provided (usually for new entries)
    ts_id = timesheet.timesheet_id or f"TS-{uuid.uuid4().hex[:8].upper()}"
    submitted = timesheet.submitted_date or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    return [
        ts_id,
        submitted,
        timesheet.work_date,
        timesheet.associate_id,
        timesheet.project_id,
        timesheet.task or "",
        timesheet.hours,
        timesheet.status,
        timesheet.comments or ""
    ]

def row_to_timesheet(record: dict, row_index: int = None) -> Timesheet:
    return Timesheet(
        timesheet_id=str(record.get("Timesheet ID", "")),
        submitted_date=str(record.get("Submitted Date", "")),
        work_date=str(record.get("Work Date", "")),
        associate_id=str(record.get("Associate ID", "")),
        project_id=str(record.get("Project ID", "")),
        task=str(record.get("Task", "")),
        hours=float(record.get("Hours", 0) or 0),
        status=str(record.get("Status", "Submitted")),
        comments=str(record.get("Comments", "")),
        row_index=row_index
    )
