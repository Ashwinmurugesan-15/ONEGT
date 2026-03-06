import os
import sys

# Add backend to path
sys.path.append('/Users/kbsivacse/Documents/Tools/OneGT/backend')

from services.google_sheets import sheets_service
from services.google_drive import drive_service
from config import settings

def get_html_from_drive(value: str) -> str:
    if not value or not isinstance(value, str):
        return value
    v_strip = value.strip()
    if v_strip.startswith("DRIVE_FILE:"):
        file_id = v_strip.replace("DRIVE_FILE:", "")
        content = drive_service.get_file_content(file_id)
        if content: return content
    return value

def main():
    try:
        SHEET_NAME = settings.CRMS_INVOICE_TEMPLATES_SHEET
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        for record in records:
            name = record.get("Name", "")
            print(f"Template Name: {name}")
            header_html = get_html_from_drive(record.get("Header HTML", ""))
            print("--- Header HTML ---")
            print(header_html)
            print("-------------------")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
