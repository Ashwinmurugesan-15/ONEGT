from pydantic import BaseModel
from typing import Optional, List

class InvoiceItem(BaseModel):
    description: str = ""
    quantity: float = 0
    price_per_unit: float = 0
    item_price: float = 0

class InvoiceBase(BaseModel):
    gst_invoice_id: Optional[str] = ""
    gst_on_time: Optional[str] = ""
    invoice_created: Optional[str] = ""
    contract_id: Optional[str] = ""
    customer_id: Optional[str] = ""
    sow_number: Optional[str] = ""
    project_id: Optional[str] = ""
    invoice_date: str
    payment_due_date: Optional[str] = ""
    actual_payment_date: Optional[str] = ""
    invoice_type: Optional[str] = ""
    currency: str = "USD"
    items: List[InvoiceItem] = []
    subtotal: float = 0
    tax_percent: float = 0
    tax_fees: float = 0
    discount: float = 0
    invoice_total: float = 0
    in_inr: float = 0
    invoice_status: str = "Draft"

class InvoiceCreate(InvoiceBase):
    invoice_id: str

class InvoiceUpdate(BaseModel):
    gst_invoice_id: Optional[str] = None
    gst_on_time: Optional[str] = None
    invoice_created: Optional[str] = None
    contract_id: Optional[str] = None
    customer_id: Optional[str] = None
    sow_number: Optional[str] = None
    project_id: Optional[str] = None
    invoice_date: Optional[str] = None
    payment_due_date: Optional[str] = None
    actual_payment_date: Optional[str] = None
    invoice_type: Optional[str] = None
    currency: Optional[str] = None
    items: Optional[List[InvoiceItem]] = None
    subtotal: Optional[float] = None
    tax_percent: Optional[float] = None
    tax_fees: Optional[float] = None
    discount: Optional[float] = None
    invoice_total: Optional[float] = None
    in_inr: Optional[float] = None
    invoice_status: Optional[str] = None

class Invoice(InvoiceBase):
    invoice_id: str
    
    class Config:
        from_attributes = True

# Column mapping for Google Sheets
INVOICE_COLUMNS = [
    "InvoiceID", "GST INVOICE ID", "GST on Time", "InvoiceCreated", "ContractID",
    "CustomerID", "SOW Number", "Project ID", "InvoiceDate", "PayementDueDate",
    "Actual Payement Date", "InvoiceType", "Currency",
    "InvoiceItem1", "InvoiceQty1", "PricePerUnit1", "ItemPrice1",
    "InvoiceItem2", "InvoiceQty2", "PricePerUnit2", "ItemPrice2",
    "InvoiceItem3", "InvoiceQty3", "PricePerUnit3", "ItemPrice3",
    "InvoiceItem4", "InvoiceQty4", "PricePerUnit4", "ItemPrice4",
    "InvoiceItem5", "InvoiceQty5", "PricePerUnit5", "ItemPrice5",
    "InvoiceItem6", "InvoiceQty6", "PricePerUnit6", "ItemPrice6",
    "InvoiceItem7", "InvoiceQty7", "PricePerUnit7", "ItemPrice7",
    "SubTotal", "TaxPercent", "Tax Fees", "Discount", "InvoiceTotal",
    "in INR", "Invoice Status"
]

def invoice_to_row(invoice: InvoiceCreate) -> list:
    row = [
        invoice.invoice_id,
        invoice.gst_invoice_id or "",
        invoice.gst_on_time or "",
        invoice.invoice_created or "",
        invoice.contract_id or "",
        invoice.customer_id or "",
        invoice.sow_number or "",
        invoice.project_id or "",
        invoice.invoice_date,
        invoice.payment_due_date or "",
        invoice.actual_payment_date or "",
        invoice.invoice_type or "",
        invoice.currency
    ]
    
    # Add up to 7 invoice items
    for i in range(7):
        if i < len(invoice.items):
            item = invoice.items[i]
            row.extend([item.description, item.quantity, item.price_per_unit, item.item_price])
        else:
            row.extend(["", 0, 0, 0])
    
    row.extend([
        invoice.subtotal,
        invoice.tax_percent,
        invoice.tax_fees,
        invoice.discount,
        invoice.invoice_total,
        invoice.in_inr,
        invoice.invoice_status
    ])
    
    return row

def row_to_invoice(record: dict) -> Invoice:
    items = []
    for i in range(1, 8):
        desc = record.get(f"InvoiceItem{i}", "")
        if desc:
            items.append(InvoiceItem(
                description=str(desc),
                quantity=float(record.get(f"InvoiceQty{i}", 0) or 0),
                price_per_unit=float(record.get(f"PricePerUnit{i}", 0) or 0),
                item_price=float(record.get(f"ItemPrice{i}", 0) or 0)
            ))
    
    return Invoice(
        invoice_id=str(record.get("InvoiceID", "")),
        gst_invoice_id=str(record.get("GST INVOICE ID", "")),
        gst_on_time=str(record.get("GST on Time", "")),
        invoice_created=str(record.get("InvoiceCreated", "")),
        contract_id=str(record.get("ContractID", "")),
        customer_id=str(record.get("CustomerID", "")),
        sow_number=str(record.get("SOW Number", "")),
        project_id=str(record.get("Project ID", "")),
        invoice_date=str(record.get("InvoiceDate", "")),
        payment_due_date=str(record.get("PayementDueDate", "")),
        actual_payment_date=str(record.get("Actual Payement Date", "")),
        invoice_type=str(record.get("InvoiceType", "")),
        currency=str(record.get("Currency", "USD")),
        items=items,
        subtotal=float(record.get("SubTotal", 0) or 0),
        tax_percent=float(record.get("TaxPercent", 0) or 0),
        tax_fees=float(record.get("Tax Fees", 0) or 0),
        discount=float(record.get("Discount", 0) or 0),
        invoice_total=float(record.get("InvoiceTotal", 0) or 0),
        in_inr=float(record.get("in INR", 0) or 0),
        invoice_status=str(record.get("Invoice Status", "Draft"))
    )
