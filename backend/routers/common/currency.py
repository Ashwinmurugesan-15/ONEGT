from fastapi import APIRouter, HTTPException
from typing import List, Optional
from services.google_sheets import sheets_service
from models.common.currency import (
    CurrencyRate, CurrencyRateCreate, CurrencyRateUpdate,
    row_to_currency_rate, currency_rate_to_row, BASE_COLUMNS,
    get_month_order, get_previous_month, get_current_month
)
from config import settings

router = APIRouter()

def get_currency_columns() -> List[str]:
    """Get all currency columns from the sheet headers."""
    try:
        headers = sheets_service.get_headers(settings.CURRENCY_SHEET)
        if not headers:
            return ["USD", "INR", "SGD"]
        # Filter out Year and Month, return currency columns
        return [h for h in headers if h not in ["Year", "Month"]]
    except Exception:
        return ["USD", "INR", "SGD"]

@router.get("/", response_model=List[CurrencyRate])
async def get_currency_rates(year: Optional[int] = None, month: Optional[str] = None):
    """Get all currency rates, optionally filtered by year and month."""
    try:
        # Ensure sheet exists with at least base columns
        sheets_service.create_sheet_if_not_exists(
            settings.CURRENCY_SHEET, ["Year", "Month", "USD", "INR", "SGD"]
        )
        
        currencies = get_currency_columns()
        records = sheets_service.get_all_records(settings.CURRENCY_SHEET)
        
        rates = []
        for r in records:
            if r.get("Year") and r.get("Month"):
                rate = row_to_currency_rate(r, currencies)
                # Apply filters
                if year and rate.year != year:
                    continue
                if month and rate.month != month:
                    continue
                rates.append(rate)
        
        # Sort by year and month
        month_order = get_month_order()
        rates.sort(key=lambda x: (x.year, month_order.get(x.month, 0)), reverse=True)
        
        return rates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/currencies", response_model=List[str])
async def get_available_currencies():
    """Get list of available currencies in the sheet."""
    try:
        return get_currency_columns()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/check-missing", response_model=dict)
async def check_missing_entry():
    """Check if last month's entry is missing."""
    try:
        prev_year, prev_month = get_previous_month()
        curr_year, curr_month = get_current_month()
        
        records = sheets_service.get_all_records(settings.CURRENCY_SHEET)
        
        prev_exists = any(
            int(r.get("Year", 0)) == prev_year and r.get("Month") == prev_month
            for r in records if r.get("Year")
        )
        curr_exists = any(
            int(r.get("Year", 0)) == curr_year and r.get("Month") == curr_month
            for r in records if r.get("Year")
        )
        
        missing = []
        if not prev_exists:
            missing.append({"year": prev_year, "month": prev_month})
        if not curr_exists:
            missing.append({"year": curr_year, "month": curr_month})
        
        return {
            "has_missing": len(missing) > 0,
            "missing_entries": missing
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# IMPORTANT: trend endpoint MUST come before /{year}/{month} to avoid routing conflict
@router.get("/trend/{months}", response_model=List[CurrencyRate])
async def get_currency_trend(months: int = 12):
    """Get currency rates for the last N months for trend chart."""
    try:
        currencies = get_currency_columns()
        records = sheets_service.get_all_records(settings.CURRENCY_SHEET)
        
        rates = []
        for r in records:
            if r.get("Year") and r.get("Month"):
                rates.append(row_to_currency_rate(r, currencies))
        
        # Sort by year and month
        month_order = get_month_order()
        rates.sort(key=lambda x: (x.year, month_order.get(x.month, 0)), reverse=True)
        
        # Return last N months
        return rates[:months]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add-currency/{currency_code}", response_model=dict)
async def add_new_currency(currency_code: str):
    """Add a new currency column to the sheet."""
    try:
        currency_code = currency_code.upper()
        current_currencies = get_currency_columns()
        
        if currency_code in current_currencies:
            raise HTTPException(status_code=400, detail=f"Currency {currency_code} already exists")
        
        # Add new column header
        headers = sheets_service.get_headers(settings.CURRENCY_SHEET)
        new_col_index = len(headers) + 1
        
        # Update header row with new currency
        sheets_service.update_cell(
            settings.CURRENCY_SHEET, 1, new_col_index, currency_code
        )
        
        return {"message": f"Currency {currency_code} added successfully", "column": new_col_index}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# These routes with path parameters come LAST
@router.get("/{year}/{month}", response_model=CurrencyRate)
async def get_currency_rate(year: int, month: str):
    """Get currency rate for a specific year and month."""
    try:
        currencies = get_currency_columns()
        records = sheets_service.get_all_records(settings.CURRENCY_SHEET)
        
        for r in records:
            if int(r.get("Year", 0)) == year and r.get("Month") == month:
                return row_to_currency_rate(r, currencies)
        
        raise HTTPException(status_code=404, detail="Currency rate not found for this period")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=dict)
async def create_currency_rate(rate: CurrencyRateCreate):
    """Create a new currency rate entry."""
    try:
        # Ensure sheet exists
        sheets_service.create_sheet_if_not_exists(
            settings.CURRENCY_SHEET, ["Year", "Month", "USD", "INR", "SGD"]
        )
        
        # Check if entry already exists
        records = sheets_service.get_all_records(settings.CURRENCY_SHEET)
        for r in records:
            if int(r.get("Year", 0)) == rate.year and r.get("Month") == rate.month:
                raise HTTPException(status_code=400, detail="Currency rate for this period already exists")
        
        currencies = get_currency_columns()
        row = currency_rate_to_row(rate, currencies)
        result = sheets_service.append_row(settings.CURRENCY_SHEET, row)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{year}/{month}", response_model=dict)
async def update_currency_rate(year: int, month: str, update: CurrencyRateUpdate):
    """Update currency rates for a specific period."""
    try:
        records = sheets_service.get_all_records(settings.CURRENCY_SHEET)
        row_index = None
        
        for idx, r in enumerate(records):
            if int(r.get("Year", 0)) == year and r.get("Month") == month:
                row_index = idx + 2  # +2 for 1-based and header row
                break
        
        if not row_index:
            raise HTTPException(status_code=404, detail="Currency rate not found for this period")
        
        # Get current values
        currencies = get_currency_columns()
        current = row_to_currency_rate(records[row_index - 2], currencies)
        
        # Merge updates
        new_rates = {**current.rates, **update.rates}
        
        merged = CurrencyRateCreate(
            year=year,
            month=month,
            rates=new_rates
        )
        row = currency_rate_to_row(merged, currencies)
        
        result = sheets_service.update_row(settings.CURRENCY_SHEET, row_index, row)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{year}/{month}", response_model=dict)
async def delete_currency_rate(year: int, month: str):
    """Delete currency rate for a specific period."""
    try:
        records = sheets_service.get_all_records(settings.CURRENCY_SHEET)
        row_index = None
        
        for idx, r in enumerate(records):
            if int(r.get("Year", 0)) == year and r.get("Month") == month:
                row_index = idx + 2
                break
        
        if not row_index:
            raise HTTPException(status_code=404, detail="Currency rate not found for this period")
        
        result = sheets_service.delete_row(settings.CURRENCY_SHEET, row_index)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
