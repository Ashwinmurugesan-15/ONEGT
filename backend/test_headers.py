import os
import sys

# Add the backend directory to sys.path
sys.path.insert(0, '/Users/kbsivacse/Documents/Tools/OneGT/backend')

from services.google_sheets import sheets_service
from config import settings

try:
    headers = sheets_service.get_headers(settings.ASSOCIATES_SHEET)
    print("Headers count:", len(headers))
    print("Last 5 headers:", headers[-5:])
except Exception as e:
    print("Error:", e)
