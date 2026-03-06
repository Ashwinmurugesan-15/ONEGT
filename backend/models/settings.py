from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class CompanySettings(BaseModel):
    name: str
    logo_url: Optional[str] = None
    primary_color: str = "#3b82f6"
    secondary_color: str = "#10b981"
    address: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class Role(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_default: bool = False

class Permission(BaseModel):
    role_id: str
    capability_id: str
    page_id: str
    can_read: bool = True
    can_write: bool = False
    scope: str = "associate"  # associate | managing_team | all

class LeaveGroup(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    attachment_mandatory: str = "No"

class LeaveType(BaseModel):
    code: str
    name: str
    group_id: str
    is_leave: str = "Yes"
    pay_type: str = "PAID"
    active: str = "Yes"
    is_adjustable: str = "No"
    description: Optional[str] = None

class Entitlement(BaseModel):
    group_code: str
    entitlement_type: str = "common"  # 'common' or 'experience_based'
    from_year: int = 0
    to_year: int = 0
    entitlement_days: float = 0.0

class LeavePolicy(BaseModel):
    leave_type_id: str
    calculation_basis: str  # 'Join Date' or 'Financial Year'
    from_date: str  # DD/MM
    to_date: str    # DD/MM
    prorate_based_on_join_date: bool = False
    calculate_earned_leave: bool = False
    expiry_months: Optional[int] = 0
    avail_earned_leave_by: str = "Start Of Month"
    leave_limit_option: str
    entitlement_calc_basis: str = "Join Date"
    allow_viewer_calendar: bool = True
    permission_day_wise: bool = False
    permission_days_per_month: float = 0
    permission_hours_per_day: str = "00:00"
    permission_hour_wise: bool = False
    permission_hours_per_month: float = 0

class Holiday(BaseModel):
    id: str = ""
    name: str
    date: str  # ISO date string YYYY-MM-DD
    day: str = ""  # e.g. Monday, Tuesday
    holiday_type: str = "Company"  # National, Regional, Company, Optional
    applicable_to: str = "All"  # All, or specific offices/locations
    year: int = 2026
    description: Optional[str] = ""
