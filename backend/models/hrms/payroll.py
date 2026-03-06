from pydantic import BaseModel
from typing import Optional

class PayrollBase(BaseModel):
    payroll_month: str  # Mmm format (Jan, Feb, etc.)
    payroll_year: int
    associate_id: str  # Employee Code
    associate_name: Optional[str] = ""  # Looked up from Associates
    join_date: Optional[str] = "" # Looked up from Associates
    date_of_joining: Optional[str] = "" # Compatibility field
    department_name: Optional[str] = "" # Looked up from Associates
    designation_name: Optional[str] = "" # Looked up from Associates
    category_name: Optional[str] = ""
    earnings: float = 0
    statutories_amount: float = 0
    income_tax: float = 0
    deductions: float = 0
    net_pay: float = 0

class PayrollCreate(PayrollBase):
    pass

class Payroll(PayrollBase):
    row_index: Optional[int] = None
    
    class Config:
        from_attributes = True

# Column mapping - matches user's sheet headers
PAYROLL_COLUMNS = [
    "Year",
    "Month",
    "Employee Code",
    "Employee Name",
    "Department",
    "Designation",
    "Date of Joining",
    "Earnings",
    "Statutories Amount",
    "Income Tax",
    "Deductions",
    "Net Pay"
]

# Month abbreviations mapping
MONTH_ABBREV_TO_FULL = {
    "jan": "January", "feb": "February", "mar": "March", "apr": "April",
    "may": "May", "jun": "June", "jul": "July", "aug": "August",
    "sep": "September", "oct": "October", "nov": "November", "dec": "December"
}

MONTH_FULL_TO_ABBREV = {v.lower(): k.capitalize() for k, v in MONTH_ABBREV_TO_FULL.items()}

def normalize_month(month_str: str) -> str:
    """Convert month to display format (full name for display)."""
    if not month_str:
        return ""
    month_lower = month_str.strip().lower()
    # If it's abbreviated (Jan, Feb, etc.), convert to full
    if month_lower[:3] in MONTH_ABBREV_TO_FULL:
        return MONTH_ABBREV_TO_FULL[month_lower[:3]]
    # Already full name
    return month_str.capitalize()

def payroll_to_row(payroll: PayrollCreate) -> list:
    """Convert payroll model to row for sheet (uses abbreviated month)."""
    # Convert full month name to abbreviation for storage
    month_abbrev = payroll.payroll_month
    if payroll.payroll_month.lower() in MONTH_FULL_TO_ABBREV:
        month_abbrev = MONTH_FULL_TO_ABBREV[payroll.payroll_month.lower()]
    
    return [
        payroll.payroll_year,
        month_abbrev,
        payroll.associate_id,
        payroll.associate_name,
        payroll.department_name,
        payroll.designation_name,
        payroll.join_date or payroll.date_of_joining,
        payroll.earnings,
        payroll.statutories_amount,
        payroll.income_tax,
        payroll.deductions,
        payroll.net_pay
    ]

def row_to_payroll(record: dict, row_index: int = None) -> Payroll:
    """Convert sheet row to payroll model."""
    # Get month from either old or new column name
    month_raw = str(record.get("Month", "") or record.get("Payroll Month", ""))
    month_display = normalize_month(month_raw)
    
    # Get year from either old or new column name
    year_raw = record.get("Year") or record.get("Payroll Year", 0)
    
    # Get employee code from either old or new column name
    associate_id = str(record.get("Employee Code", "") or record.get("Associate ID", ""))
    
    # Get employee name from either old or new column name
    associate_name = str(record.get("Employee Name", "") or record.get("Associate Name", ""))
    
    return Payroll(
        payroll_month=month_display,
        payroll_year=int(year_raw or 0),
        associate_id=associate_id,
        associate_name=str(record.get("Employee Name") or record.get("Associate Name") or ""),
        date_of_joining=str(record.get("Date of Joining", "")),
        department_name=str(record.get("Department Name") or record.get("Department") or ""),
        designation_name=str(record.get("Designation Name") or record.get("Designation") or ""),
        category_name=str(record.get("Category Name", "")),
        earnings=float(record.get("Earnings", 0) or 0),
        statutories_amount=float(record.get("Statutories Amount", 0) or 0),
        income_tax=float(record.get("Income Tax", 0) or 0),
        deductions=float(record.get("Deductions", 0) or 0),
        net_pay=float(record.get("Net Pay", 0) or 0),
        row_index=row_index
    )
