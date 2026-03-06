import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Google Sheets
    GOOGLE_CREDENTIALS_FILE: str = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
    SPREADSHEET_ID: str = os.getenv("SPREADSHEET_ID", "")
    ROOT_FOLDER_ID: str = os.getenv("ROOT_FOLDER_ID", "")
    
    # Sheet Names
    ASSOCIATES_SHEET: str = os.getenv("ASSOCIATES_SHEET", "Associates")
    PROJECTS_SHEET: str = os.getenv("PROJECTS_SHEET", "Project Master")
    ALLOCATIONS_SHEET: str = os.getenv("ALLOCATIONS_SHEET", "Project Allocation Tracker")
    INVOICES_SHEET: str = os.getenv("INVOICES_SHEET", "Invoice")
    PAYROLL_SHEET: str = os.getenv("PAYROLL_SHEET", "Payroll")
    EXPENSES_SHEET: str = os.getenv("EXPENSES_SHEET", "Expenses")
    CURRENCY_SHEET: str = os.getenv("CURRENCY_SHEET", "Currency Rates")
    TIMESHEETS_SHEET: str = os.getenv("TIMESHEETS_SHEET", "Timesheets")
    CUSTOMERS_SHEET: str = os.getenv("CUSTOMERS_SHEET", "Customers")
    SKILLS_SHEET: str = os.getenv("SKILLS_SHEET", "Skills")
    ASSETS_SHEET: str = os.getenv("ASSETS_SHEET", "Assets")
    ASSETS_SHEET: str = os.getenv("ASSETS_SHEET", "Assets")
    NOTIFICATIONS_SHEET: str = os.getenv("NOTIFICATIONS_SHEET", "Notifications")
    DEPARTMENTS_SHEET: str = os.getenv("DEPARTMENTS_SHEET", "Departments")
    DESIGNATIONS_SHEET: str = os.getenv("DESIGNATIONS_SHEET", "Designations")
    WORK_LOCATIONS_SHEET: str = os.getenv("WORK_LOCATIONS_SHEET", "Work Locations")
    
    # Settings Sheets
    SETTINGS_COMPANY_SHEET: str = os.getenv("SETTINGS_COMPANY_SHEET", "Settings_Company")
    SETTINGS_ROLES_SHEET: str = os.getenv("SETTINGS_ROLES_SHEET", "Settings_Roles")
    SETTINGS_PERMISSIONS_SHEET: str = os.getenv("SETTINGS_PERMISSIONS_SHEET", "Settings_Permissions")
    SETTINGS_LEAVE_GROUPS_SHEET: str = os.getenv("SETTINGS_LEAVE_GROUPS_SHEET", "Settings_LeaveGroups")
    SETTINGS_LEAVE_TYPES_SHEET: str = os.getenv("SETTINGS_LEAVE_TYPES_SHEET", "Settings_LeaveTypes")
    SETTINGS_LEAVE_POLICIES_SHEET: str = os.getenv("SETTINGS_LEAVE_POLICIES_SHEET", "Settings_LeavePolicies")
    SETTINGS_LEAVE_ENTITLEMENTS_SHEET: str = os.getenv("SETTINGS_LEAVE_ENTITLEMENTS_SHEET", "Settings_LeaveEntitlements")
    SETTINGS_HOLIDAYS_SHEET: str = os.getenv("SETTINGS_HOLIDAYS_SHEET", "Settings_Holidays")
    LEAVE_APPLICATIONS_SHEET: str = os.getenv("LEAVE_APPLICATIONS_SHEET", "LeaveApplications")
    
    # Performance Management Spreadsheet Configuration
    PMS_SPREADSHEET_ID: str = os.getenv("PMS_SPREADSHEET_ID", "")
    PMS_TEMPLATES_SHEET: str = os.getenv("PMS_TEMPLATES_SHEET", "PMS_Templates")
    PMS_CATEGORIES_SHEET: str = os.getenv("PMS_CATEGORIES_SHEET", "PMS_Categories")
    PMS_GOALS_SHEET: str = os.getenv("PMS_GOALS_SHEET", "PMS_Goals")
    PMS_CYCLES_SHEET: str = os.getenv("PMS_CYCLES_SHEET", "PMS_Cycles")
    PMS_APPRAISALS_SHEET: str = os.getenv("PMS_APPRAISALS_SHEET", "PMS_Appraisals")
    PMS_APPRAISAL_GOALS_SHEET: str = os.getenv("PMS_APPRAISAL_GOALS_SHEET", "PMS_AppraisalGoals")
    PMS_AUDIT_LOG_SHEET: str = os.getenv("PMS_AUDIT_LOG_SHEET", "PMS_AuditLog")
    
    # CRMS Spreadsheet Configuration
    CRMS_SPREADSHEET_ID: str = os.getenv("CRMS_SPREADSHEET_ID", "")
    CRMS_LEADS_SHEET: str = os.getenv("CRMS_LEADS_SHEET", "Leads")
    CRMS_OPPORTUNITIES_SHEET: str = os.getenv("CRMS_OPPORTUNITIES_SHEET", "Opportunities")
    CRMS_CUSTOMERS_SHEET: str = os.getenv("CRMS_CUSTOMERS_SHEET", "Customers")
    CRMS_CONTACTS_SHEET: str = os.getenv("CRMS_CONTACTS_SHEET", "Contacts")
    CRMS_DEALS_SHEET: str = os.getenv("CRMS_DEALS_SHEET", "Deals")
    CRMS_TASKS_SHEET: str = os.getenv("CRMS_TASKS_SHEET", "Tasks")
    CRMS_CALLS_SHEET: str = os.getenv("CRMS_CALLS_SHEET", "Calls")
    CRMS_INVOICES_SHEET: str = os.getenv("CRMS_INVOICES_SHEET", "Invoices")
    CRMS_INVOICE_TEMPLATES_SHEET: str = os.getenv("CRMS_INVOICE_TEMPLATES_SHEET", "Invoice Templates")
    
    # Google Drive Configuration
    DRIVE_TEMPLATES_FOLDER_ID: str = os.getenv("DRIVE_TEMPLATES_FOLDER_ID", "")
    DRIVE_PEOPLES_FOLDER_ID: str = os.getenv("DRIVE_PEOPLES_FOLDER_ID", "")
    DRIVE_EXPENSES_FOLDER_ID: str = os.getenv("DRIVE_EXPENSES_FOLDER_ID", "")
    
    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    
    # Authentication
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "chrms-secret-key-change-in-production")
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
    
    # SMTP Configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    
    # Gmail OAuth2 Configuration
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_AUTH_URI: str = os.getenv("GOOGLE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth")
    GOOGLE_TOKEN_URI: str = os.getenv("GOOGLE_TOKEN_URI", "https://oauth2.googleapis.com/token")
    GOOGLE_REFRESH_TOKEN: str = os.getenv("GOOGLE_REFRESH_TOKEN", "")
    SMTP_USE_OAUTH2: bool = os.getenv("SMTP_USE_OAUTH2", "false").lower() == "true"

settings = Settings()
