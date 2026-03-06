from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

# Status options for expense reports
EXPENSE_REPORT_STATUS = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID"]

class ExpenseItemBase(BaseModel):
    """Individual expense line item within a report."""
    date: str
    category: str
    bill_no: Optional[str] = ""
    description: Optional[str] = ""
    expense_amount: float = 0
    expense_folder_id: str = ""
    receipt_file_id: str = ""
    payment_mode: str = "Self"
    currency: str = "INR"

class ExpenseItemCreate(ExpenseItemBase):
    """For creating new expense items."""
    pass

class ExpenseItem(ExpenseItemBase):
    """Full expense item with IDs."""
    expense_report_id: str
    expense_id: str
    row_index: Optional[int] = None

    class Config:
        from_attributes = True

class ExpenseReportBase(BaseModel):
    """Base expense report header."""
    associate_id: str
    project_id: str
    project_name: Optional[str] = ""
    expense_report_name: Optional[str] = ""
    expense_report_date: Optional[str] = ""
    date_from: Optional[str] = ""
    date_to: Optional[str] = ""

class ExpenseReportCreate(ExpenseReportBase):
    """For creating a new expense report with items."""
    items: List[ExpenseItemCreate] = []

class ExpenseReportUpdate(BaseModel):
    """For updating an expense report."""
    associate_id: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    expense_report_name: Optional[str] = None
    expense_report_date: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    items: Optional[List[ExpenseItemCreate]] = None

class ExpenseReport(ExpenseReportBase):
    """Full expense report with computed fields."""
    expense_report_id: str
    total_amount: float = 0
    self_amount: float = 0
    corporate_card_amount: float = 0
    bank_transfer_amount: float = 0
    status: str = "DRAFT"
    submitted_at: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    comments: Optional[str] = None
    items: List[ExpenseItem] = []

    class Config:
        from_attributes = True

# Column mapping for the Expenses sheet (updated structure)
EXPENSE_COLUMNS = [
    "Expense Report ID",
    "Expense Report Name",
    "Expense Report Date",
    "Expense ID",
    "Date",
    "Category",
    "Bill No",
    "Description",
    "Associate ID",
    "Project ID",
    "Expense",
    "Currency",
    "Payment Mode",
    "Expense Folder ID",
    "Receipt File ID",
    "Status",
    "Comments"
]

def generate_report_id(sequence: int) -> str:
    """Generate a unique expense report ID: GTEXPQ<quarter><year><month><seq>"""
    now = datetime.now()
    quarter = (now.month - 1) // 3 + 1
    # Format: GTEXPQ{quarter}{year}{month:02d}{sequence:03d}
    return f"GTEXPQ{quarter}{now.year}{now.month:02d}{sequence:03d}"

def generate_expense_id(report_id: str, sequence: int) -> str:
    """Generate a unique expense item ID: <report_id>-<item_seq>"""
    # Format: {report_id}-{sequence:03d}
    return f"{report_id}-{sequence:03d}"

def expense_item_to_row(
    expense_report_id: str,
    expense_id: str,
    item: ExpenseItemCreate,
    associate_id: str,
    project_id: str,
    project_name: str,
    expense_report_name: str = "",
    expense_report_date: str = "",
    status: str = "DRAFT",
    comments: str = ""
) -> list:
    """Convert an expense item to a row for the sheet."""
    return [
        expense_report_id,
        expense_report_name,
        expense_report_date,
        expense_id,
        item.date,
        item.category,
        item.bill_no or "",
        item.description or "",
        associate_id,
        project_id,
        item.expense_amount,
        item.currency or "INR",
        item.payment_mode,
        item.expense_folder_id,
        item.receipt_file_id,
        status,
        comments
    ]

def row_to_expense_item(record: dict, row_index: int = None) -> ExpenseItem:
    """Convert a sheet row to an ExpenseItem."""
    return ExpenseItem(
        expense_report_id=str(record.get("Expense Report ID", "")),
        expense_id=str(record.get("Expense ID", "")),
        date=str(record.get("Date", "")),
        category=str(record.get("Category", "")),
        bill_no=str(record.get("Bill No", "")),
        description=str(record.get("Description", "")),
        expense_amount=float(record.get("Expense", 0) or 0),
        currency=str(record.get("Currency", "INR")),
        payment_mode=str(record.get("Payment Mode", "Self")),
        expense_folder_id=str(record.get("Expense Folder ID", "")),
        receipt_file_id=str(record.get("Receipt File ID", "")),
        row_index=row_index
    )

def group_rows_to_report(records: List[dict], report_id: str) -> Optional[ExpenseReport]:
    """Group expense rows into an ExpenseReport object."""
    report_rows = [r for r in records if r.get("Expense Report ID") == report_id]
    
    if not report_rows:
        return None
    
    # Get header info from first row
    first_row = report_rows[0]
    
    # Build items list
    items = []
    total = 0
    self_total = 0
    corp_total = 0
    bank_total = 0
    for idx, r in enumerate(report_rows):
        item = row_to_expense_item(r)
        items.append(item)
        total += item.expense_amount
        if item.payment_mode == 'Corporate Card':
            corp_total += item.expense_amount
        elif item.payment_mode == 'Bank Transfer':
            bank_total += item.expense_amount
        else:
            self_total += item.expense_amount
    
    # Get date range from items
    dates = [r.get("Date", "") for r in report_rows if r.get("Date")]
    date_from = min(dates) if dates else ""
    date_to = max(dates) if dates else ""
    
    return ExpenseReport(
        expense_report_id=report_id,
        associate_id=str(first_row.get("Associate ID", "")),
        project_id=str(first_row.get("Project ID", "")),
        project_name="", # Not stored in sheet anymore
        expense_report_name=str(first_row.get("Expense Report Name", "")),
        expense_report_date=str(first_row.get("Expense Report Date", "")),
        date_from=date_from,
        date_to=date_to,
        total_amount=total,
        self_amount=self_total,
        corporate_card_amount=corp_total,
        bank_transfer_amount=bank_total,
        status=str(first_row.get("Status", "DRAFT")),
        comments=str(first_row.get("Comments", "")),
        items=items
    )
