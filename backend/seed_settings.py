from services.google_sheets import sheets_service
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_settings")

def seed():
    # 1. Company Settings
    company_headers = ["name", "logo_url", "primary_color", "secondary_color", "address", "website", "email", "phone"]
    sheets_service.create_sheet_if_not_exists(settings.SETTINGS_COMPANY_SHEET, company_headers)
    if not sheets_service.get_all_records(settings.SETTINGS_COMPANY_SHEET):
        sheets_service.append_row(settings.SETTINGS_COMPANY_SHEET, [
            "OneGT", "", "#3b82f6", "#10b981", "123 Tech Park, Silicon Valley", "https://onegt.com", "contact@onegt.com", "+1-555-0123"
        ])
        logger.info("Seeded Company Settings")

    # 2. Roles
    role_headers = ["id", "name", "description"]
    sheets_service.create_sheet_if_not_exists(settings.SETTINGS_ROLES_SHEET, role_headers)
    if not sheets_service.get_all_records(settings.SETTINGS_ROLES_SHEET):
        sheets_service.append_rows(settings.SETTINGS_ROLES_SHEET, [
            ["admin", "Admin", "Full system access"],
            ["ops_mgr", "Operations Manager", "Manage operations and projects"],
            ["hr_mgr", "HR Manager", "Manage people and payroll"],
            ["mkt_mgr", "Marketing Manager", "Manage leads and campaigns"]
        ])
        logger.info("Seeded Roles")

    # 3. Leave Groups
    lg_headers = ["code", "name", "description", "attachment_mandatory"]
    sheets_service.create_sheet_if_not_exists(settings.SETTINGS_LEAVE_GROUPS_SHEET, lg_headers)
    if not sheets_service.get_all_records(settings.SETTINGS_LEAVE_GROUPS_SHEET):
        sheets_service.append_rows(settings.SETTINGS_LEAVE_GROUPS_SHEET, [
            ["SL", "Standard Leaves", "Common leave types for all associates", "No"],
            ["SPL", "Special Leaves", "Specific cases like Maternity/Paternity", "Yes"]
        ])
        logger.info("Seeded Leave Groups")

    # 4. Leave Types
    lt_headers = ["code", "name", "group_id", "is_leave", "pay_type", "active", "is_adjustable", "description"]
    sheets_service.create_sheet_if_not_exists(settings.SETTINGS_LEAVE_TYPES_SHEET, lt_headers)
    if not sheets_service.get_all_records(settings.SETTINGS_LEAVE_TYPES_SHEET):
        sheets_service.append_rows(settings.SETTINGS_LEAVE_TYPES_SHEET, [
            ["SL", "Sick Leave", "SL", "Yes", "PAID", "Yes", "No", "Medical leave"],
            ["CL", "Casual Leave", "SL", "Yes", "PAID", "Yes", "No", "Personal use"],
            ["EL", "Earned Leave", "SL", "Yes", "PAID", "Yes", "No", "Accrued vacation"],
            ["ML", "Maternity Leave", "SPL", "Yes", "PAID", "Yes", "No", "Parental leave"]
        ])
        logger.info("Seeded Leave Types")

    logger.info("Seeding completed successfully")

if __name__ == "__main__":
    seed()
