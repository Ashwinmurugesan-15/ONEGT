from pydantic import BaseModel
from typing import Optional

class ExpenseBase(BaseModel):
    date: str
    category: str
    bill_no: Optional[str] = ""
    description: Optional[str] = ""
    associate_id: Optional[str] = ""
    project_id: Optional[str] = ""
    expense_amount: float = 0
    receipt: Optional[str] = ""

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    date: Optional[str] = None
    category: Optional[str] = None
    bill_no: Optional[str] = None
    description: Optional[str] = None
    associate_id: Optional[str] = None
    project_id: Optional[str] = None
    expense_amount: Optional[float] = None
    receipt: Optional[str] = None

class Expense(ExpenseBase):
    row_index: Optional[int] = None
    
    class Config:
        from_attributes = True

# Column mapping - matches exact sheet headers
EXPENSE_COLUMNS = [
    "Date",
    "Category",
    "Bill No",
    "Description",
    "AssociateID",
    "Project ID",
    "Expense",
    "Receipt"
]

def expense_to_row(expense: ExpenseCreate) -> list:
    return [
        expense.date,
        expense.category,
        expense.bill_no or "",
        expense.description or "",
        expense.associate_id or "",
        expense.project_id or "",
        expense.expense_amount,
        expense.receipt or ""
    ]

def row_to_expense(record: dict, row_index: int = None) -> Expense:
    return Expense(
        date=str(record.get("Date", "")),
        category=str(record.get("Category", "")),
        bill_no=str(record.get("Bill No", "")),
        description=str(record.get("Description", "")),
        associate_id=str(record.get("AssociateID", "")),
        project_id=str(record.get("Project ID", "")),
        expense_amount=float(record.get("Expense", 0) or 0),
        receipt=str(record.get("Receipt", "")),
        row_index=row_index
    )
