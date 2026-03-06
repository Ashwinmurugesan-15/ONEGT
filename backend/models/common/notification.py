from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

class NotificationBase(BaseModel):
    user_id: str  # The recipient (Associate ID)
    type: str  # 'TimesheetSubmitted', 'TimesheetApproved', 'TimesheetRejected'
    title: str
    message: str
    link: Optional[str] = ""
    is_read: bool = False
    created_at: Optional[str] = None

class NotificationCreate(NotificationBase):
    pass

class Notification(NotificationBase):
    notification_id: str
    row_index: Optional[int] = None

    class Config:
        from_attributes = True

NOTIFICATION_COLUMNS = [
    "Notification ID",
    "User ID",
    "Type",
    "Title",
    "Message",
    "Link",
    "Is Read",
    "Created At"
]

def notification_to_row(notification: NotificationCreate) -> list:
    notif_id = f"NT-{uuid.uuid4().hex[:8].upper()}"
    created = notification.created_at or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    return [
        notif_id,
        notification.user_id,
        notification.type,
        notification.title,
        notification.message,
        notification.link or "",
        "TRUE" if notification.is_read else "FALSE",
        created
    ]

def row_to_notification(record: dict, row_index: int = None) -> Notification:
    is_read_raw = str(record.get("Is Read", "FALSE")).upper()
    return Notification(
        notification_id=str(record.get("Notification ID", "")),
        user_id=str(record.get("User ID", "")),
        type=str(record.get("Type", "")),
        title=str(record.get("Title", "")),
        message=str(record.get("Message", "")),
        link=str(record.get("Link", "")),
        is_read=is_read_raw == "TRUE",
        created_at=str(record.get("Created At", "")),
        row_index=row_index
    )
