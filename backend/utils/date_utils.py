from datetime import datetime

def format_date_for_sheet(iso_date_str: str) -> str:
    """
    Converts ISO date string (YYYY-MM-DD) to Sheet format (DD-MMM-YYYY).
    Example: 2026-02-04 -> 04-Feb-2026
    Returns empty string if input is invalid or empty.
    """
    if not iso_date_str:
        return ""
    try:
        dt = datetime.strptime(iso_date_str, "%Y-%m-%d")
        return dt.strftime("%d-%b-%Y")
    except ValueError:
        # If it's already in the target format or another format, return as is or handle logic
        return iso_date_str

def parse_date_from_sheet(sheet_date_str: str) -> str:
    """
    Converts Sheet date string (DD-MMM-YYYY or other formats) to ISO format (YYYY-MM-DD).
    Example: 04-Feb-2026 -> 2026-02-04
    Returns empty string if input is invalid or empty.
    """
    if not sheet_date_str:
        return ""
    
    # List of formats to try parsing
    formats = [
        "%d-%b-%Y",  # 04-Feb-2026
        "%Y-%m-%d",  # 2026-02-04
        "%d/%m/%Y",  # 04/02/2026
        "%m/%d/%Y",  # 02/04/2026
        "%d-%m-%Y"   # 04-02-2026
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(sheet_date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    return sheet_date_str
