from pydantic import BaseModel, field_validator
from typing import Optional
import re

class InvoiceTemplateBase(BaseModel):
    name: str
    header_html: str = ""
    footer_html: str = ""
    logo_url: Optional[str] = None
    primary_color: str = "#2563eb"
    secondary_color: str = "#64748b"
    table_header_color: str = "#f3f4f6"
    table_total_color: str = "#f0fdf4"
    font_family: str = "Inter, sans-serif"
    is_default: bool = False
    items_html: str = ""

    @field_validator('primary_color', 'secondary_color', 'table_header_color', 'table_total_color')
    @classmethod
    def validate_hex_color(cls, v):
        if v and not re.match(r'^#[0-9a-fA-F]{6}$', v):
            raise ValueError(f'Invalid hex color: {v}. Must be format #XXXXXX')
        return v


class InvoiceTemplateCreate(InvoiceTemplateBase):
    pass

class InvoiceTemplateUpdate(BaseModel):
    name: Optional[str] = None
    header_html: Optional[str] = None
    footer_html: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    table_header_color: Optional[str] = None
    table_total_color: Optional[str] = None
    font_family: Optional[str] = None
    is_default: Optional[bool] = None
    items_html: Optional[str] = None

class InvoiceTemplateModel(InvoiceTemplateBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
