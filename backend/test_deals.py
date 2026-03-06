import asyncio
from config import settings
from services.google_sheets import sheets_service

async def main():
    deals = sheets_service.get_crms_all_records(settings.CRMS_DEALS_SHEET)
    print(f"Total deals in sheet: {len(deals)}")
    
    for d in deals:
        name = d.get('Deal Name', '')
        curr = d.get('Currency', '')
        stage = d.get('Stage', '')
        print(f"Name: {name}, Currency: {curr}, Stage: {stage}")

if __name__ == "__main__":
    asyncio.run(main())
