import sys
import os
sys.path.append('/Users/kbsivacse/Documents/Tools/OneGT/backend')

from config import settings
from services.google_sheets import sheets_service
import json

deals = sheets_service.get_crms_all_records(settings.CRMS_DEALS_SHEET)
print(json.dumps(deals[0] if deals else {}, indent=2))
