from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
import logging
import traceback
import uuid
import threading
import re

from models.crms.invoice_template import InvoiceTemplateModel, InvoiceTemplateCreate, InvoiceTemplateUpdate
from services.google_sheets import sheets_service
from services.google_drive import drive_service
from middleware.auth_middleware import get_current_user, TokenData
from config import settings

logger = logging.getLogger(__name__)

_id_lock = threading.Lock()
DRIVE_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{25,50}$')

router = APIRouter(prefix="/crms/invoice-templates", tags=["CRMS - Invoice Templates"])

SHEET_NAME = settings.CRMS_INVOICE_TEMPLATES_SHEET
ID_COLUMN = "Template Id" # Default expected

def get_actual_id_column(record: dict) -> str:
    """Detect if the column is 'Template Id' or 'Temlpate Id'."""
    if "Temlpate Id" in record:
        return "Temlpate Id"
    return "Template Id"

def generate_template_id():
    """Generate a unique template ID in format GTTPLXXXXXX. Thread-safe."""
    with _id_lock:
      try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        max_id = 0
        id_col = "Template Id"
        if records:
            id_col = get_actual_id_column(records[0])
            
        for record in records:
            tpl_id = str(record.get(id_col, ""))
            if tpl_id.startswith("GTTPL"):
                try:
                    num_part = int(tpl_id[5:])
                    if num_part > max_id:
                        max_id = num_part
                except ValueError:
                    continue
        
        next_id = max_id + 1
        return f"GTTPL{next_id:06d}"
      except Exception as e:
        logger.error(f"Error generating template ID: {e}")
        return f"GTTPL{uuid.uuid4().hex[:6].upper()}"

def get_html_from_drive(value: str) -> str:
    """Robustly fetch content from Drive if value is an ID or prefixed ID."""
    if not value or not isinstance(value, str):
        return value
        
    v_strip = value.strip()
    
    # Case 1: Prefixed ID (Always try to fetch)
    if v_strip.startswith("DRIVE_FILE:"):
        file_id = v_strip.replace("DRIVE_FILE:", "")
        logger.debug(f"Detected prefixed Drive ID: {file_id}")
        content = drive_service.get_file_content(file_id)
        if content:
            return content
        logger.warning(f"Failed to fetch content for prefixed ID: {file_id}")
        return "Error loading from Drive"
        
    # Case 2: Raw ID — strict pattern match to avoid speculative API calls
    if not v_strip.startswith("<") and DRIVE_ID_PATTERN.match(v_strip):
        logger.debug(f"Attempting to fetch raw Drive ID: {v_strip}")
        drive_content = drive_service.get_file_content(v_strip)
        if drive_content:
            logger.debug(f"Successfully fetched content for raw ID: {v_strip}")
            return drive_content
        else:
            logger.warning(f"Raw ID detected but content fetch failed or returned empty: {v_strip}. Assuming it's a regular string.")
            
    return value


@router.get("", response_model=List[InvoiceTemplateModel])
async def get_templates(current_user: TokenData = Depends(get_current_user)):
    """Get all invoice templates."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        templates = []
        
        id_col = "Template Id"
        if records:
            id_col = get_actual_id_column(records[0])
            
        for record in records:
            header_html = get_html_from_drive(record.get("Header HTML", ""))
            footer_html = get_html_from_drive(record.get("Footer HTML", ""))
            items_html = get_html_from_drive(record.get("Table HTML", ""))

            templates.append(InvoiceTemplateModel(
                id=str(record.get(id_col, "")),
                name=record.get("Name", ""),
                header_html=header_html,
                footer_html=footer_html,
                items_html=items_html,
                logo_url=record.get("Logo URL", "") or None,
                primary_color=record.get("Primary Color", "#2563eb"),
                secondary_color=record.get("Secondary Color", "#64748b"),
                table_header_color=record.get("Table Header Color", "#f3f4f6"),
                table_total_color=record.get("Table Total Color", "#f0fdf4"),
                font_family=record.get("Font Family", "Inter, sans-serif"),
                is_default=str(record.get("Is Default", "")).lower() == "true",
                created_at=record.get("Created At", "") or None,
                updated_at=record.get("Updated At", "") or None
            ))
        
        return templates
    except Exception as e:
        logger.error(f"Error getting templates: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="An internal error occurred while fetching templates")


@router.get("/{template_id}", response_model=InvoiceTemplateModel)
async def get_template(template_id: str, current_user: TokenData = Depends(get_current_user)):
    """Get a single template by ID."""
    try:
        # First get all records to detect column casing
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        id_col = "Template Id"
        if records:
            id_col = get_actual_id_column(records[0])
            
        record = sheets_service.crms_get_row_by_id(SHEET_NAME, id_col, template_id)
        if not record:
            raise HTTPException(status_code=404, detail="Template not found")
        
        header_html = get_html_from_drive(record.get("Header HTML", ""))
        footer_html = get_html_from_drive(record.get("Footer HTML", ""))
        items_html = get_html_from_drive(record.get("Table HTML", ""))

        return InvoiceTemplateModel(
            id=str(record.get(id_col, "")),
            name=record.get("Name", ""),
            header_html=header_html,
            footer_html=footer_html,
            items_html=items_html,
            logo_url=record.get("Logo URL", "") or None,
            primary_color=record.get("Primary Color", "#2563eb"),
            secondary_color=record.get("Secondary Color", "#64748b"),
            table_header_color=record.get("Table Header Color", "#f3f4f6"),
            table_total_color=record.get("Table Total Color", "#f0fdf4"),
            font_family=record.get("Font Family", "Inter, sans-serif"),
            is_default=str(record.get("Is Default", "")).lower() == "true",
            created_at=record.get("Created At", "") or None,
            updated_at=record.get("Updated At", "") or None
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template {template_id}: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="An internal error occurred while fetching template")


@router.post("", response_model=InvoiceTemplateModel)
async def create_template(template: InvoiceTemplateCreate, current_user: TokenData = Depends(get_current_user)):
    """Create a new invoice template."""
    try:
        template_id = generate_template_id()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        header_html = template.header_html
        footer_html = template.footer_html
        
        # Save to Drive if folder ID is configured
        if settings.DRIVE_TEMPLATES_FOLDER_ID:
            if header_html:
                filename = f"{template_id}_header_{uuid.uuid4().hex[:6]}.html"
                file_id = drive_service.upload_file(header_html, filename, settings.DRIVE_TEMPLATES_FOLDER_ID)
                if file_id:
                    header_html = f"DRIVE_FILE:{file_id}"
            
            if footer_html:
                filename = f"{template_id}_footer_{uuid.uuid4().hex[:6]}.html"
                file_id = drive_service.upload_file(footer_html, filename, settings.DRIVE_TEMPLATES_FOLDER_ID)
                if file_id:
                    footer_html = f"DRIVE_FILE:{file_id}"
            
            if template.items_html:
                filename = f"{template_id}_items_{uuid.uuid4().hex[:6]}.html"
                file_id = drive_service.upload_file(template.items_html, filename, settings.DRIVE_TEMPLATES_FOLDER_ID)
                if file_id:
                    items_html = f"DRIVE_FILE:{file_id}"
                else:
                    items_html = template.items_html
            else:
                items_html = ""
        else:
            items_html = template.items_html

        # Columns: Template Id, Name, Header HTML, Footer HTML, Table HTML, Logo URL, 
        # Table Header Color, Table Total Color, Primary Color, Secondary Color, Font Family, Is Default, Created At, Updated At
        values = [
            template_id,
            template.name,
            header_html,
            footer_html,
            items_html,
            template.logo_url or "",
            template.table_header_color,
            template.table_total_color,
            template.primary_color,
            template.secondary_color,
            template.font_family,
            "true" if template.is_default else "false",
            now,
            now
        ]
        
        sheets_service.crms_append_row(SHEET_NAME, values)
        
        return InvoiceTemplateModel(
            id=template_id,
            name=template.name,
            header_html=template.header_html,
            footer_html=template.footer_html,
            items_html=template.items_html,
            logo_url=template.logo_url,
            primary_color=template.primary_color,
            secondary_color=template.secondary_color,
            table_header_color=template.table_header_color,
            table_total_color=template.table_total_color,
            font_family=template.font_family,
            is_default=template.is_default,
            created_at=now,
            updated_at=now
        )
    except Exception as e:
        logger.error(f"Error creating template: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="An internal error occurred while creating template")


@router.put("/{template_id}", response_model=InvoiceTemplateModel)
async def update_template(template_id: str, update: InvoiceTemplateUpdate, current_user: TokenData = Depends(get_current_user)):
    """Update an existing template."""
    try:
        # Detect column casing
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        id_col = "Template Id"
        if records:
            id_col = get_actual_id_column(records[0])
            
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, id_col, template_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Template not found")
        
        existing = sheets_service.crms_get_row_by_id(SHEET_NAME, id_col, template_id)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        header_html = update.header_html if update.header_html is not None else existing.get("Header HTML", "")
        footer_html = update.footer_html if update.footer_html is not None else existing.get("Footer HTML", "")
        items_html = update.items_html if update.items_html is not None else existing.get("Table HTML", "")
        
        # Handle Drive updates
        if settings.DRIVE_TEMPLATES_FOLDER_ID:
            if update.header_html is not None:
                # If existing was a drive file, update it
                old_val = existing.get("Header HTML", "")
                if old_val.startswith("DRIVE_FILE:"):
                    file_id = old_val.replace("DRIVE_FILE:", "")
                    drive_service.update_file(file_id, update.header_html)
                    header_html = old_val
                else:
                    # Upload new one
                    filename = f"{template_id}_header_{uuid.uuid4().hex[:6]}.html"
                    file_id = drive_service.upload_file(update.header_html, filename, settings.DRIVE_TEMPLATES_FOLDER_ID)
                    if file_id:
                        header_html = f"DRIVE_FILE:{file_id}"

            if update.footer_html is not None:
                old_val = existing.get("Footer HTML", "")
                if old_val.startswith("DRIVE_FILE:"):
                    file_id = old_val.replace("DRIVE_FILE:", "")
                    drive_service.update_file(file_id, update.footer_html)
                    footer_html = old_val
                else:
                    filename = f"{template_id}_footer_{uuid.uuid4().hex[:6]}.html"
                    file_id = drive_service.upload_file(update.footer_html, filename, settings.DRIVE_TEMPLATES_FOLDER_ID)
                    if file_id:
                        footer_html = f"DRIVE_FILE:{file_id}"
            
            if update.items_html is not None:
                old_val = existing.get("Table HTML", "")
                if old_val.startswith("DRIVE_FILE:"):
                    file_id = old_val.replace("DRIVE_FILE:", "")
                    drive_service.update_file(file_id, update.items_html)
                    items_html = old_val
                else:
                    filename = f"{template_id}_items_{uuid.uuid4().hex[:6]}.html"
                    file_id = drive_service.upload_file(update.items_html, filename, settings.DRIVE_TEMPLATES_FOLDER_ID)
                    if file_id:
                        items_html = f"DRIVE_FILE:{file_id}"
                    else:
                        items_html = update.items_html

        values = [
            template_id,
            update.name if update.name is not None else existing.get("Name", ""),
            header_html,
            footer_html,
            items_html,
            update.logo_url if update.logo_url is not None else existing.get("Logo URL", ""),
            update.table_header_color if update.table_header_color is not None else existing.get("Table Header Color", "#f3f4f6"),
            update.table_total_color if update.table_total_color is not None else existing.get("Table Total Color", "#f0fdf4"),
            update.primary_color if update.primary_color is not None else existing.get("Primary Color", "#2563eb"),
            update.secondary_color if update.secondary_color is not None else existing.get("Secondary Color", "#64748b"),
            update.font_family if update.font_family is not None else existing.get("Font Family", "Inter, sans-serif"),
            "true" if (update.is_default if update.is_default is not None else str(existing.get("Is Default", "")).lower() == "true") else "false",
            existing.get("Created At", ""),
            now
        ]
        
        sheets_service.crms_update_row(SHEET_NAME, row_index, values)
        
        return InvoiceTemplateModel(
            id=template_id,
            name=values[1],
            header_html=update.header_html if update.header_html is not None else get_html_from_drive(existing.get("Header HTML", "")),
            footer_html=update.footer_html if update.footer_html is not None else get_html_from_drive(existing.get("Footer HTML", "")),
            items_html=update.items_html if update.items_html is not None else get_html_from_drive(existing.get("Table HTML", "")),
            logo_url=values[5] or None,
            table_header_color=values[6],
            table_total_color=values[7],
            primary_color=values[8],
            secondary_color=values[9],
            font_family=values[10],
            is_default=values[11] == "true",
            created_at=values[12],
            updated_at=now
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating template: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="An internal error occurred while updating template")


@router.delete("/{template_id}")
async def delete_template(template_id: str, current_user: TokenData = Depends(get_current_user)):
    """Delete a template."""
    try:
        # Detect column casing
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        id_col = "Template Id"
        if records:
            id_col = get_actual_id_column(records[0])
            
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, id_col, template_id)
        if not row_index:
            raise HTTPException(status_code=404, detail="Template found in ID lookup but not in row index search")
            
        existing = sheets_service.crms_get_row_by_id(SHEET_NAME, id_col, template_id)
        if existing:
            header_html = existing.get("Header HTML", "")
            footer_html = existing.get("Footer HTML", "")
            
            if header_html.startswith("DRIVE_FILE:"):
                drive_service.delete_file(header_html.replace("DRIVE_FILE:", ""))
            if footer_html.startswith("DRIVE_FILE:"):
                drive_service.delete_file(footer_html.replace("DRIVE_FILE:", ""))
            
            items_html = existing.get("Table HTML", "")
            if items_html.startswith("DRIVE_FILE:"):
                drive_service.delete_file(items_html.replace("DRIVE_FILE:", ""))

        sheets_service.crms_delete_row(SHEET_NAME, row_index)
        return {"success": True, "message": "Template deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting template {template_id}: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="An internal error occurred while deleting template")
