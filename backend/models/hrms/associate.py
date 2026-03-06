from pydantic import BaseModel, EmailStr
from typing import Optional, Literal, List
from datetime import date
from enum import Enum


class AssociateBase(BaseModel):
    associate_name: str
    status: str = ""  # Active, Inactive, etc.
    gender: str = ""
    join_date: str = ""
    email: str
    previous_experience_months: int = 0
    company_experience_months: int = 0  # GuhaTek Experience
    total_experience_months: int = 0
    experience_formatted: str = ""  # Experience (Y/M format)
    department_id: str = ""
    designation_id: str = ""
    manager_id: str = "" # Manager's Associate ID
    location: str = ""  # Office location
    currency: str = "INR"  # Salary currency (INR, USD, etc.)
    fixed_ctc: float = 0
    bonus: float = 0
    benefits: float = 0
    ctc: float = 0
    skill_family: str = ""  # Skill family category
    skills: str = ""  # Comma-separated list of skills
    profile_link: str = ""  # Google Drive profile link
    phone: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    country: str = ""
    postal_code: str = ""
    dob: str = "" # Date of Birth
    personal_email: str = ""
    national_id_type: str = ""  # Aadhaar, SSN, etc.
    national_id_number: str = ""
    national_id_proof: str = ""  # Drive file ID for proof document
    tax_id_type: str = ""  # PAN, Tax ID, etc.
    tax_id_number: str = ""
    tax_id_proof: str = ""  # Drive file ID for proof document
    passport_number: str = ""
    passport_issue_country: str = ""
    passport_issue_date: str = ""
    passport_expiry_date: str = ""
    passport_proof: str = "" # Drive file ID
    bank_account_number: str = ""
    bank_account_name: str = ""
    ifsc_code: str = ""
    photo: str = "" # Drive file ID/Link
    drive_folder_id: str = ""  # Google Drive folder ID for this associate
    corporate_card_number: str = ""
    corporate_card_expiry: str = ""
    corporate_card_bank: str = ""
    resignation_submit_date: str = ""
    exit_date: str = ""
    exit_category: str = "" # Voluntary / Involuntary
    exit_reason: str = ""
    iam_role_id: str = ""  # IAM Role ID (e.g. GTRL0001)

class AssociateCreate(AssociateBase):
    associate_id: str = ""  # Auto-generated if not provided

class AssociateUpdate(BaseModel):
    associate_name: Optional[str] = None
    status: Optional[str] = None
    gender: Optional[str] = None
    join_date: Optional[str] = None
    email: Optional[str] = None
    previous_experience_months: Optional[int] = None
    company_experience_months: Optional[int] = None
    total_experience_months: Optional[int] = None
    experience_formatted: Optional[str] = None
    department_id: Optional[str] = None
    designation_id: Optional[str] = None
    manager_id: Optional[str] = None
    location: Optional[str] = None
    currency: Optional[str] = None
    fixed_ctc: Optional[float] = None
    bonus: Optional[float] = None
    benefits: Optional[float] = None
    ctc: Optional[float] = None
    skill_family: Optional[str] = None
    skills: Optional[str] = None
    profile_link: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    dob: Optional[str] = None
    personal_email: Optional[str] = None
    national_id_type: Optional[str] = None
    national_id_number: Optional[str] = None
    national_id_proof: Optional[str] = None
    tax_id_type: Optional[str] = None
    tax_id_number: Optional[str] = None
    tax_id_proof: Optional[str] = None
    passport_number: Optional[str] = None
    passport_issue_country: Optional[str] = None
    passport_issue_date: Optional[str] = None
    passport_expiry_date: Optional[str] = None
    passport_proof: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    photo: Optional[str] = None
    drive_folder_id: Optional[str] = None
    corporate_card_number: Optional[str] = None
    corporate_card_expiry: Optional[str] = None
    corporate_card_bank: Optional[str] = None
    resignation_submit_date: Optional[str] = None
    exit_date: Optional[str] = None
    exit_category: Optional[str] = None
    exit_reason: Optional[str] = None
    iam_role_id: Optional[str] = None

class Associate(AssociateBase):
    associate_id: str
    
    class Config:
        from_attributes = True

# Column mapping for Google Sheets (must match exact header names)
ASSOCIATE_COLUMNS = [
    "Associate ID",
    "Associate Name",
    "Status",
    "Gender",
    "Join date",
    "Email",
    "Previous Experience (Months)",
    "GuhaTek Experience (Months)",
    "Total Experience (Months)",
    "Experience",
    "Department ID",
    "Designation ID",
    "Manager",
    "Location",
    "Currency",
    "Fixed CTC",
    "Bonus",
    "Benefits",
    "CTC",
    "Skill Family",
    "Skills",
    "Profile",
    "Phone",
    "Address",
    "City",
    "State",
    "Country",
    "Postal Code",
    "DOB",
    "Personal Email",
    "National ID Type",
    "National ID Number",
    "National ID Proof",
    "Tax ID Type",
    "Tax ID Number",
    "Tax ID Proof",
    "Passport Number",
    "Passport Issue Country",
    "Passport Issue Date",
    "Passport Expiry Date",
    "Passport Proof",
    "Bank Account Number",
    "Bank Account Name",
    "IFSC Code",
    "Photo",
    "Drive Folder ID",
    "Corporate Card Number",
    "Corporate Card Expiry",
    "Corporate Card Bank",
    "Resignation Submit Date",
    "Exit Date",
    "Exit Category",
    "Exit Reason",
    "IAM Role ID"
]

def safe_int(value, default=0):
    """Safely convert value to int."""
    if value is None or value == "":
        return default
    try:
        # Handle string numbers with commas
        if isinstance(value, str):
            value = value.replace(",", "").strip()
        return int(float(value))
    except (ValueError, TypeError):
        return default

def safe_float(value, default=0.0):
    """Safely convert value to float."""
    if value is None or value == "":
        return default
    try:
        # Handle string numbers with commas and currency symbols
        if isinstance(value, str):
            # Remove common currency symbols and commas
            value = value.replace(",", "").replace("$", "").replace("₹", "").replace("€", "").strip()
        return float(value)
    except (ValueError, TypeError):
        return default

from utils.date_utils import format_date_for_sheet, parse_date_from_sheet

def associate_to_row(associate: AssociateCreate) -> list:
    """Convert Associate model to sheet row."""
    # Must match ASSOCIATE_COLUMNS order
    return [
        associate.associate_id,
        associate.associate_name,
        associate.status,
        associate.gender,
        format_date_for_sheet(associate.join_date),
        associate.email,
        associate.previous_experience_months,
        associate.company_experience_months,
        associate.total_experience_months,
        associate.experience_formatted,
        associate.department_id,
        associate.designation_id,
        associate.manager_id,
        associate.location,
        associate.currency,
        associate.fixed_ctc,
        associate.bonus,
        associate.benefits,
        associate.ctc,
        associate.skill_family,
        associate.skills,
        associate.profile_link,
        associate.phone,
        associate.address,
        associate.city,
        associate.state,
        associate.country,
        associate.postal_code,
        format_date_for_sheet(associate.dob),
        associate.personal_email,
        associate.national_id_type,
        associate.national_id_number,
        associate.national_id_proof,
        associate.tax_id_type,
        associate.tax_id_number,
        associate.tax_id_proof,
        associate.passport_number,
        associate.passport_issue_country,
        format_date_for_sheet(associate.passport_issue_date),
        format_date_for_sheet(associate.passport_expiry_date),
        associate.passport_proof,
        associate.bank_account_number,
        associate.bank_account_name,
        associate.ifsc_code,
        associate.photo,
        associate.drive_folder_id,
        associate.corporate_card_number,
        format_date_for_sheet(associate.corporate_card_expiry),
        associate.corporate_card_bank,
        format_date_for_sheet(associate.resignation_submit_date),
        format_date_for_sheet(associate.exit_date),
        associate.exit_category,
        associate.exit_reason,
        associate.iam_role_id
    ]

def row_to_associate(record: dict) -> Associate:
    """Convert sheet record to Associate model."""
    return Associate(
        associate_id=str(record.get("Associate ID", "")).strip().lower(),
        associate_name=str(record.get("Associate Name", "") or "").strip(),
        status=str(record.get("Status", "") or "").strip(),
        gender=str(record.get("Gender", "") or "").strip(),
        join_date=parse_date_from_sheet(str(record.get("Join date", "") or "")),
        email=str(record.get("Email", "") or "").strip().lower(),
        previous_experience_months=safe_int(record.get("Previous Experience (Months)")),
        company_experience_months=safe_int(record.get("GuhaTek Experience (Months)")),
        total_experience_months=safe_int(record.get("Total Experience (Months)")),
        experience_formatted=str(record.get("Experience", "") or "").strip(),
        department_id=str(record.get("Department ID") or record.get("Department") or "").strip(),
        designation_id=str(record.get("Designation ID") or record.get("Designation") or "").strip(),
        manager_id=str(record.get("Manager", "") or "").strip().lower(),
        location=str(record.get("Location", "") or ""),
        currency=str(record.get("Currency", "INR") or "INR"),
        fixed_ctc=safe_float(record.get("Fixed CTC")),
        bonus=safe_float(record.get("Bonus")),
        benefits=safe_float(record.get("Benefits")),
        ctc=safe_float(record.get("CTC")),
        skill_family=str(record.get("Skill Family", "") or ""),
        skills=str(record.get("Skills", "") or ""),
        profile_link=str(record.get("Profile", "") or ""),
        phone=str(record.get("Phone", "") or ""),
        address=str(record.get("Address", "") or ""),
        city=str(record.get("City", "") or ""),
        state=str(record.get("State", "") or ""),
        country=str(record.get("Country", "") or ""),
        postal_code=str(record.get("Postal Code", "") or ""),
        dob=parse_date_from_sheet(str(record.get("DOB", "") or "")),
        personal_email=str(record.get("Personal Email", "") or ""),
        national_id_type=str(record.get("National ID Type", "") or ""),
        national_id_number=str(record.get("National ID Number", "") or ""),
        national_id_proof=str(record.get("National ID Proof", "") or ""),
        tax_id_type=str(record.get("Tax ID Type", "") or ""),
        tax_id_number=str(record.get("Tax ID Number", "") or ""),
        tax_id_proof=str(record.get("Tax ID Proof", "") or ""),
        passport_number=str(record.get("Passport Number", "") or ""),
        passport_issue_country=str(record.get("Passport Issue Country", "") or ""),
        passport_issue_date=parse_date_from_sheet(str(record.get("Passport Issue Date", "") or "")),
        passport_expiry_date=parse_date_from_sheet(str(record.get("Passport Expiry Date", "") or "")),
        passport_proof=str(record.get("Passport Proof", "") or ""),
        bank_account_number=str(record.get("Bank Account Number", "") or ""),
        bank_account_name=str(record.get("Bank Account Name", "") or ""),
        ifsc_code=str(record.get("IFSC Code", "") or ""),
        photo=str(record.get("Photo") or record.get("photo") or ""),
        drive_folder_id=str(record.get("Drive Folder ID", "") or ""),
        corporate_card_number=str(record.get("Corporate Card Number", "") or ""),
        corporate_card_expiry=parse_date_from_sheet(str(record.get("Corporate Card Expiry", "") or "")),
        corporate_card_bank=str(record.get("Corporate Card Bank", "") or ""),
        resignation_submit_date=parse_date_from_sheet(str(record.get("Resignation Submit Date", "") or "")),
        exit_date=parse_date_from_sheet(str(record.get("Exit Date", "") or "")),
        exit_category=str(record.get("Exit Category", "") or ""),
        exit_reason=str(record.get("Exit Reason", "") or ""),
        iam_role_id=str(record.get("IAM Role ID") or record.get("Role ID", "") or "")
    )
