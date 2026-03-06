from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class CurrencyRateBase(BaseModel):
    year: int
    month: str  # Month name like "January", "February"
    usd: float = 1.0
    inr: Optional[float] = None
    sgd: Optional[float] = None
    # Dynamic currencies can be added

class CurrencyRateCreate(BaseModel):
    year: int
    month: str
    rates: Dict[str, float]  # {"USD": 1.0, "INR": 83.5, "SGD": 1.35}

class CurrencyRateUpdate(BaseModel):
    rates: Dict[str, float]  # Partial update of rates

class CurrencyRate(BaseModel):
    year: int
    month: str
    rates: Dict[str, float]  # All currency rates for this period
    
    class Config:
        from_attributes = True

# Base columns that are always present
BASE_COLUMNS = ["Year", "Month", "USD"]

# Default currency columns (can be extended dynamically)
DEFAULT_CURRENCIES = ["USD", "INR", "SGD"]

def get_month_order() -> Dict[str, int]:
    """Return month name to order mapping (supports short names)."""
    return {
        "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4,
        "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
        "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
    }

def get_month_name(month_num: int) -> str:
    """Convert month number to short name."""
    months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return months[month_num] if 1 <= month_num <= 12 else ""

def row_to_currency_rate(record: dict, currencies: List[str]) -> CurrencyRate:
    """Convert a sheet row to CurrencyRate object."""
    rates = {}
    for curr in currencies:
        val = record.get(curr, 0)
        try:
            rates[curr] = float(val) if val else 0
        except (ValueError, TypeError):
            rates[curr] = 0
    
    year = record.get("Year", 0)
    try:
        year = int(year) if year else 0
    except (ValueError, TypeError):
        year = 0
    
    return CurrencyRate(
        year=year,
        month=str(record.get("Month", "")),
        rates=rates
    )

def currency_rate_to_row(rate: CurrencyRateCreate, currencies: List[str]) -> list:
    """Convert CurrencyRate to sheet row."""
    row = [rate.year, rate.month]
    for curr in currencies:
        row.append(rate.rates.get(curr, 0))
    return row

def get_previous_month() -> tuple:
    """Get previous month's year and month name."""
    from datetime import datetime
    now = datetime.now()
    if now.month == 1:
        return now.year - 1, "December"
    else:
        return now.year, get_month_name(now.month - 1)

def get_current_month() -> tuple:
    """Get current month's year and month name."""
    from datetime import datetime
    now = datetime.now()
    return now.year, get_month_name(now.month)
