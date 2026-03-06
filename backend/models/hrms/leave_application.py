import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class LeaveApplicationBase(BaseModel):
    associate_id: str
    associate_name: str = ""
    leave_type_code: str  # e.g. "CL", "SL", "EL"
    from_date: str  # YYYY-MM-DD
    to_date: str    # YYYY-MM-DD
    half_day: bool = False
    half_day_period: str = ""  # "first_half" or "second_half"
    reason: str = ""
    total_days: float = 0
    status: str = "Pending"  # Pending, Approved, Rejected
    applied_on: str = ""
    approved_by: str = ""
    remarks: str = ""

class LeaveApplicationCreate(LeaveApplicationBase):
    pass

class LeaveApplication(LeaveApplicationBase):
    id: str = ""
    row_index: Optional[int] = None

    class Config:
        from_attributes = True

LEAVE_APPLICATION_COLUMNS = [
    "Leave ID",
    "Associate ID",
    "Associate Name",
    "Leave Type Code",
    "From Date",
    "To Date",
    "Half Day",
    "Half Day Period",
    "Reason",
    "Total Days",
    "Status",
    "Applied On",
    "Approved By",
    "Remarks"
]

def leave_application_to_row(app: LeaveApplicationCreate, leave_id: str = None) -> list:
    lid = leave_id or f"LV-{uuid.uuid4().hex[:8].upper()}"
    applied = app.applied_on or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return [
        lid,
        app.associate_id,
        app.associate_name,
        app.leave_type_code,
        app.from_date,
        app.to_date,
        str(app.half_day),
        app.half_day_period or "",
        app.reason or "",
        app.total_days,
        app.status,
        applied,
        app.approved_by or "",
        app.remarks or ""
    ]

def row_to_leave_application(record: dict, row_index: int = None) -> LeaveApplication:
    half_day_val = str(record.get("Half Day", "")).strip().lower()
    return LeaveApplication(
        id=str(record.get("Leave ID", "")),
        associate_id=str(record.get("Associate ID", "")),
        associate_name=str(record.get("Associate Name", "")),
        leave_type_code=str(record.get("Leave Type Code", "")),
        from_date=str(record.get("From Date", "")),
        to_date=str(record.get("To Date", "")),
        half_day=half_day_val in ("true", "1", "yes"),
        half_day_period=str(record.get("Half Day Period", "")),
        reason=str(record.get("Reason", "")),
        total_days=float(record.get("Total Days", 0) or 0),
        status=str(record.get("Status", "Pending")),
        applied_on=str(record.get("Applied On", "")),
        approved_by=str(record.get("Approved By", "")),
        remarks=str(record.get("Remarks", "")),
        row_index=row_index
    )
