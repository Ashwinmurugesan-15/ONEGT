from pydantic import BaseModel
from typing import Optional, List

class Department(BaseModel):
    department_id: str
    department_name: str

class WorkLocation(BaseModel):
    work_location_id: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None

class DataRole(BaseModel):
    """
    Represents a Job Role / Designation from the Designations sheet.
    Renamed to DataRole to avoid conflict with UserRole enum.
    """
    role_id: str
    role_name: str
    department_id: str
    is_manager: bool = False

# Column mapping for Google Sheets
DEPARTMENT_COLUMNS = ["Department ID", "Department Name"]
DESIGNATION_COLUMNS = ["Role ID", "Role Name", "Department ID", "Manager"]
WORK_LOCATION_COLUMNS = ["Work Location Id", "Name", "Address", "City", "State", "Country", "Postal Code"]

def row_to_department(record: dict) -> Department:
    return Department(
        department_id=str(record.get("Department ID") or record.get("Department Id") or ""),
        department_name=str(record.get("Department Name", "") or "")
    )

def row_to_role(record: dict) -> DataRole:
    is_manager_val = str(record.get("Manager", "N")).upper() == "Y"
    return DataRole(
        role_id=str(record.get("Role ID") or record.get("Role Id") or ""),
        role_name=str(record.get("Role Name", "") or ""),
        department_id=str(record.get("Department ID") or record.get("Department Id") or ""),
        is_manager=is_manager_val
    )

def row_to_work_location(record: dict) -> WorkLocation:
    return WorkLocation(
        work_location_id=str(record.get("Work Location Id") or record.get("Work Location ID") or ""),
        name=str(record.get("Name", "") or ""),
        address=str(record.get("Address", "") or ""),
        city=str(record.get("City", "") or ""),
        state=str(record.get("State", "") or ""),
        country=str(record.get("Country", "") or ""),
        postal_code=str(record.get("Postal Code") or record.get("Postal code") or "")
    )
