from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from services.google_sheets import sheets_service
from models.common.notification import (
    Notification, NotificationCreate, notification_to_row, 
    row_to_notification, NOTIFICATION_COLUMNS
)
from config import settings
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=List[Notification])
async def get_notifications(user_id: str):
    """Get notifications for a specific user."""
    try:
        sheets_service.create_sheet_if_not_exists(
            settings.NOTIFICATIONS_SHEET if hasattr(settings, 'NOTIFICATIONS_SHEET') else "Notifications", 
            NOTIFICATION_COLUMNS
        )
        
        sheet_name = settings.NOTIFICATIONS_SHEET if hasattr(settings, 'NOTIFICATIONS_SHEET') else "Notifications"
        records = sheets_service.get_all_records(sheet_name)
        notifications = []
        
        # Cleanup old notifications (older than 7 days) and deleted rows
        today = datetime.now()
        valid_records = []
        needs_rewrite = False
        
        for r in records:
            # Check age
            created_at_str = str(r.get("Created At", "")).strip()
            is_valid = True
            
            if created_at_str:
                try:
                    # Try parsing (assuming ISO or similar, adjust format as in model usually %Y-%m-%d %H:%M:%S)
                    # Model uses: datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    created_at = datetime.strptime(created_at_str, "%Y-%m-%d %H:%M:%S")
                    if (today - created_at).days > 7:
                        is_valid = False
                except:
                    pass # Keep if bad format to be safe or delete? Keep safe.
            
            if is_valid:
                valid_records.append(r)
            else:
                needs_rewrite = True

        if needs_rewrite:
            # Rewrite sheet with valid records
            # We need to preserve header. records contains dicts.
            # Convert back to list of lists
            header = NOTIFICATION_COLUMNS
            new_rows = []
            for r in valid_records:
                # Map dict back to ordered list based on header
                row = [r.get(col, "") for col in header]
                new_rows.append(row)
            
            sheets_service.clear_sheet(sheet_name)
            sheets_service.update_values(sheet_name, [header] + new_rows)
            records = valid_records # Update records for current request

        notifications = []
        search_id = str(user_id).strip()
        for idx, r in enumerate(records):
            if str(r.get("User ID", "")).strip() == search_id:
                notifications.append(row_to_notification(r, idx + 2))
        
        # Sort by created_at descending
        notifications.sort(key=lambda x: x.created_at or "", reverse=True)
        return notifications
    except Exception as e:
        import traceback
        print(f"Error fetching notifications for user {user_id}:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=dict)
async def create_notification(notification: NotificationCreate):
    """Create a new notification."""
    try:
        sheet_name = settings.NOTIFICATIONS_SHEET if hasattr(settings, 'NOTIFICATIONS_SHEET') else "Notifications"
        sheets_service.create_sheet_if_not_exists(sheet_name, NOTIFICATION_COLUMNS)
        
        row = notification_to_row(notification)
        result = sheets_service.append_row(sheet_name, row)
        return result
    except Exception as e:
        import traceback
        print("Error creating notification:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{row_index}/read", response_model=dict)
async def mark_as_read(row_index: int):
    """Mark a notification as read."""
    try:
        sheet_name = settings.NOTIFICATIONS_SHEET if hasattr(settings, 'NOTIFICATIONS_SHEET') else "Notifications"
        # Delete the row instead of marking as read
        sheets_service.delete_row(sheet_name, row_index)
        return {"success": True, "message": "Notification deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mark-all-read", response_model=dict)
async def mark_all_read(user_id: str):
    """Mark all notifications as read for a user."""
    try:
        sheet_name = settings.NOTIFICATIONS_SHEET if hasattr(settings, 'NOTIFICATIONS_SHEET') else "Notifications"
        records = sheets_service.get_all_records(sheet_name)
        
        # Filter out user's notifications (delete them)
        kept_rows = []
        count = 0
        search_id = str(user_id).strip()
        
        for r in records:
            if str(r.get("User ID", "")).strip() == search_id:
                # Skip this row (delete)
                count += 1
                continue
            kept_rows.append([r.get(col, "") for col in NOTIFICATION_COLUMNS])
        
        if count > 0:
             sheets_service.clear_sheet(sheet_name)
             sheets_service.update_values(sheet_name, [NOTIFICATION_COLUMNS] + kept_rows)
        
        return {"success": True, "message": f"Marked {count} notifications as read"}
    except Exception as e:
        import traceback
        print(f"Error marking notifications read for user {user_id}:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
