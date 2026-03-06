"""
Asset model for asset management.
"""
from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


# Default asset types - can be extended
DEFAULT_ASSET_TYPES = [
    "Welcome Kit",
    "Laptop",
    "Laptop Bag",
    "Headset"
]


class AssetBase(BaseModel):
    asset_type: str = ""
    asset_name: str = ""
    serial_no: str = ""
    owner: str = ""  # Associate ID who owns the asset
    username: str = ""  # Display name of owner
    model: str = ""
    color: str = ""
    processor: str = ""
    memory: str = ""
    disk: str = ""
    screen_type: str = ""
    other_spec: str = ""
    warranty_years: int = 0
    vendor: str = ""
    purchase_date: str = ""
    warranty_expiry: str = ""
    operating_system: str = ""
    client_onboarding_status: str = ""  # Active, In Active
    client_onboarding_software: str = ""


class AssetCreate(AssetBase):
    """Asset creation - ID is auto-generated."""
    pass


class AssetUpdate(BaseModel):
    asset_type: Optional[str] = None
    asset_name: Optional[str] = None
    serial_no: Optional[str] = None
    owner: Optional[str] = None
    username: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    processor: Optional[str] = None
    memory: Optional[str] = None
    disk: Optional[str] = None
    screen_type: Optional[str] = None
    other_spec: Optional[str] = None
    warranty_years: Optional[int] = None
    vendor: Optional[str] = None
    purchase_date: Optional[str] = None
    warranty_expiry: Optional[str] = None
    operating_system: Optional[str] = None
    client_onboarding_status: Optional[str] = None
    client_onboarding_software: Optional[str] = None


class Asset(AssetBase):
    asset_id: str
    
    class Config:
        from_attributes = True


# Column mapping for Google Sheets
ASSET_COLUMNS = [
    "Asset ID",
    "Asset Type",
    "Asset Name",
    "Serial No",
    "Owner",
    "Username",
    "Model",
    "Color",
    "Processor",
    "Memory",
    "Disk",
    "Screen Type",
    "Other Spec",
    "Warranty in Years",
    "Vendor",
    "Purchase Date",
    "Warranty Expiry Date",
    "Operating System",
    "Client Onboarding Status",
    "Client Onboarding Software"
]


def safe_int(value, default=0):
    """Safely convert value to int."""
    if value is None or value == "":
        return default
    try:
        if isinstance(value, str):
            value = value.replace(",", "").strip()
        return int(float(value))
    except (ValueError, TypeError):
        return default


def generate_asset_id(existing_ids: List[str]) -> str:
    """Generate next asset ID in format GTA10001, GTA10002, etc."""
    if not existing_ids:
        return "GTA10001"
    
    max_num = 10000
    for id_str in existing_ids:
        if id_str.startswith("GTA"):
            try:
                num = int(id_str[3:])
                if num > max_num:
                    max_num = num
            except ValueError:
                continue
    
    return f"GTA{max_num + 1}"


def asset_to_row(asset: AssetCreate, asset_id: str) -> list:
    """Convert Asset model to sheet row."""
    return [
        asset_id,
        asset.asset_type,
        asset.asset_name,
        asset.serial_no,
        asset.owner,
        asset.username,
        asset.model,
        asset.color,
        asset.processor,
        asset.memory,
        asset.disk,
        asset.screen_type,
        asset.other_spec,
        asset.warranty_years,
        asset.vendor,
        asset.purchase_date,
        asset.warranty_expiry,
        asset.operating_system,
        asset.client_onboarding_status,
        asset.client_onboarding_software
    ]


def row_to_asset(record: dict) -> Asset:
    """Convert sheet record to Asset model."""
    return Asset(
        asset_id=str(record.get("Asset ID", "") or ""),
        asset_type=str(record.get("Asset Type", "") or ""),
        asset_name=str(record.get("Asset Name", "") or ""),
        serial_no=str(record.get("Serial No", "") or ""),
        owner=str(record.get("Owner", "") or ""),
        username=str(record.get("Username", "") or ""),
        model=str(record.get("Model", "") or ""),
        color=str(record.get("Color", "") or ""),
        processor=str(record.get("Processor", "") or ""),
        memory=str(record.get("Memory", "") or ""),
        disk=str(record.get("Disk", "") or ""),
        screen_type=str(record.get("Screen Type", "") or ""),
        other_spec=str(record.get("Other Spec", "") or ""),
        warranty_years=safe_int(record.get("Warranty in Years")),
        vendor=str(record.get("Vendor", "") or ""),
        purchase_date=str(record.get("Purchase Date", "") or ""),
        warranty_expiry=str(record.get("Warranty Expiry Date", "") or ""),
        operating_system=str(record.get("Operating System", "") or ""),
        client_onboarding_status=str(record.get("Client Onboarding Status", "") or ""),
        client_onboarding_software=str(record.get("Client Onboarding Software", "") or "")
    )
