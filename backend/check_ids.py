import os
import sys
# Add current directory to path
sys.path.append(os.getcwd())

from dotenv import load_dotenv
load_dotenv()
from services.google_sheets import sheets_service
from config import settings

print("Configured Spreadsheet ID:", settings.SPREADSHEET_ID)
print("PROJECTS_SHEET:", settings.PROJECTS_SHEET)

try:
    proj_records = sheets_service.get_all_records(settings.PROJECTS_SHEET)
    print(f"Found {len(proj_records)} projects.")
    for r in proj_records:
        pid = r.get("Project ID")
        pm_id = r.get("Project Manager ID")
        print(f"Project: '{pid}', PM ID: '{pm_id}'")
        
    assoc_records = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
    print(f"Found {len(assoc_records)} associates.")
    for r in assoc_records:
        aid = r.get("Associate ID")
        email = r.get("Email")
        print(f"Associate: '{aid}', Email: '{email}'")

except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Error: {e}")
