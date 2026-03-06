from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Optional
from datetime import datetime
import logging
import traceback
import uuid
import json

from models.crms.task import Task, TaskCreate, TaskUpdate, TaskComment
from services.google_sheets import sheets_service
from services.email_service import email_service
from config import settings
from middleware.auth_middleware import get_current_user, TokenData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crms/tasks", tags=["CRMS - Tasks"])

SHEET_NAME = settings.CRMS_TASKS_SHEET


def generate_task_id():
    """Generate a unique task ID in format GTTSKXXXXXX."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        max_id = 0
        for record in records:
            task_id = str(record.get("Task ID", ""))
            if task_id.startswith("GTTSK"):
                try:
                    num_part = int(task_id[5:])
                    if num_part > max_id:
                        max_id = num_part
                except ValueError:
                    continue
        
        next_id = max_id + 1
        return f"GTTSK{next_id:06d}"
    except Exception as e:
        logger.error(f"Error generating task ID: {e}")
        return f"GTTSK-{uuid.uuid4().hex[:6].upper()}"


def parse_comments(comments_str: str) -> List[TaskComment]:
    """Parse comments JSON string to list of TaskComment objects."""
    if not comments_str:
        return []
    try:
        data = json.loads(comments_str)
        return [TaskComment(**c) for c in data]
    except json.JSONDecodeError:
        # backwards compatibility for plain text comments
        if comments_str:
            return [TaskComment(
                id=uuid.uuid4().hex,
                author_id="system",
                author_name="System",
                content=comments_str,
                created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )]
        return []
    except Exception as e:
        logger.error(f"Error parsing comments: {e}")
        return []


def serialize_comments(comments: List[TaskComment]) -> str:
    """Serialize list of TaskComment objects to JSON string."""
    try:
        return json.dumps([c.dict() for c in comments])
    except Exception as e:
        logger.error(f"Error serializing comments: {e}")
        return ""


@router.get("", response_model=List[Task])
async def get_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[str] = None,
    related_type: Optional[str] = None,
    related_id: Optional[str] = None
):
    """Get all tasks with optional filters."""
    try:
        records = sheets_service.get_crms_all_records(SHEET_NAME)
        tasks = []
        
        for record in records:
            if status and record.get("Status", "") != status:
                continue
            if priority and record.get("Priority", "") != priority:
                continue
            if assigned_to and record.get("Assigned To", "") != assigned_to:
                continue
            if related_type and record.get("Related To", "") != related_type:
                continue
            if related_id and record.get("Related Id", "") != related_id:
                continue
            
            tasks.append(Task(
                id=str(record.get("Task Id", "") or record.get("Task ID", "")),
                related_type=record.get("Related To", "") or None,
                related_id=str(record.get("Related Id", "") or record.get("Related ID", "") or ""),
                title=record.get("Title", ""),
                description=record.get("Description", "") or None,
                comments=parse_comments(record.get("Comments", "")),
                due_date=record.get("Due Date", "") or None,
                priority=record.get("Priority", "Medium"),
                status=record.get("Status", "Open"),
                assigned_to=str(record.get("Assigned To", "") or ""),
                created_at=record.get("Created On", "") or record.get("Created At", "") or None,
                updated_at=record.get("Updated On", "") or record.get("Updated At", "") or None
            ))
        
        return tasks
    except Exception as e:
        logger.error(f"Error in get_tasks: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{task_id}", response_model=Task)
async def get_task(task_id: str):
    """Get a single task by ID."""
    try:
        record = sheets_service.crms_get_row_by_id(SHEET_NAME, "Task Id", task_id)
        if not record:
             record = sheets_service.crms_get_row_by_id(SHEET_NAME, "Task ID", task_id)
        
        if not record:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return Task(
            id=str(record.get("Task Id", "") or record.get("Task ID", "")),
            related_type=record.get("Related To", "") or None,
            related_id=str(record.get("Related Id", "") or record.get("Related ID", "") or ""),
            title=record.get("Title", ""),
            description=record.get("Description", "") or None,
            comments=parse_comments(record.get("Comments", "")),
            due_date=record.get("Due Date", "") or None,
            priority=record.get("Priority", "Medium"),
            status=record.get("Status", "Open"),
            assigned_to=str(record.get("Assigned To", "") or ""),
            created_at=record.get("Created On", "") or record.get("Created At", "") or None,
            updated_at=record.get("Updated On", "") or record.get("Updated At", "") or None
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_task: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Task)
async def create_task(
    task: TaskCreate,
    background_tasks: BackgroundTasks,
    current_user: TokenData = Depends(get_current_user)
):
    """Create a new task."""
    try:
        task_id = generate_task_id()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Headers: Task Id, Title, Status, Priority, Due Date, Assigned To, Related To, Related Id, Description, Comments, Created On, Updated On
        values = [
            task_id,                        # Task Id
            task.title,                     # Title
            task.status,                    # Status
            task.priority,                  # Priority
            task.due_date or "",            # Due Date
            task.assigned_to or "",         # Assigned To
            task.related_type or "",        # Related To
            task.related_id or "",          # Related Id
            task.description or "",         # Description
            serialize_comments(task.comments), # Comments
            now,                            # Created On
            now                             # Updated On
        ]
        
        sheets_service.crms_append_row(SHEET_NAME, values)
        
        # Resolve assignee email
        assignee_email = None
        assignee_name = task.assigned_to or "Unknown Assignee"
        if task.assigned_to:
            record = sheets_service.get_row_by_id(settings.ASSOCIATES_SHEET, "Associate ID", task.assigned_to)
            if record:
                assignee_email = record.get("Email", "")
                # Format just their name if possible
                assignee_name = str(record.get("Associate Name", task.assigned_to)).strip()
        
        # Queue email notification
        background_tasks.add_task(
            email_service.send_task_creation_email,
            creator_email=current_user.email,
            creator_name=current_user.name,
            assignee_email=assignee_email,
            assignee_name=assignee_name,
            task_id=task_id,
            task_title=task.title,
            priority=task.priority,
            due_date=task.due_date
        )
        
        return Task(
            id=task_id,
            related_type=task.related_type,
            related_id=task.related_id,
            title=task.title,
            description=task.description,
            comments=task.comments,
            due_date=task.due_date,
            priority=task.priority,
            status=task.status,
            assigned_to=task.assigned_to,
            created_at=now,
            updated_at=now
        )
    except Exception as e:
        logger.error(f"Error creating task: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{task_id}", response_model=Task)
async def update_task(task_id: str, update: TaskUpdate):
    """Update an existing task."""
    try:
        # Try finding by "Task Id" first
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, "Task Id", task_id)
        if not row_index:
             row_index = sheets_service.crms_find_row_index(SHEET_NAME, "Task ID", task_id)
             
        if not row_index:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Get existing record to merge
        existing = sheets_service.crms_get_row_by_id(SHEET_NAME, "Task Id", task_id) or sheets_service.crms_get_row_by_id(SHEET_NAME, "Task ID", task_id)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Handle comments update
        existing_comments_str = existing.get("Comments", "")
        existing_comments = parse_comments(existing_comments_str)
        new_comments = existing_comments
        if update.comments is not None:
             new_comments = update.comments
        
        # Headers: Task Id, Title, Status, Priority, Due Date, Assigned To, Related To, Related Id, Description, Comments, Created On, Updated On
        
        values = [
            task_id,
            update.title if update.title is not None else existing.get("Title", ""),
            update.status if update.status is not None else existing.get("Status", "Open"),
            update.priority if update.priority is not None else existing.get("Priority", "Medium"),
            update.due_date if update.due_date is not None else existing.get("Due Date", ""),
            update.assigned_to if update.assigned_to is not None else existing.get("Assigned To", ""),
            update.related_type if update.related_type is not None else existing.get("Related To", ""),
            update.related_id if update.related_id is not None else existing.get("Related Id", ""),
            update.description if update.description is not None else existing.get("Description", ""),
            serialize_comments(new_comments),
            existing.get("Created On") or existing.get("Created At", ""),
            now
        ]
        
        sheets_service.crms_update_row(SHEET_NAME, row_index, values)
        
        return Task(
            id=task_id,
            related_type=values[6] or None,
            related_id=str(values[7] or ""),
            title=values[1],
            description=values[8] or None,
            comments=new_comments,
            due_date=values[4] or None,
            priority=values[3],
            status=values[2],
            assigned_to=str(values[5] or ""),
            created_at=values[10],
            updated_at=now
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating task: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Delete a task."""
    try:
        row_index = sheets_service.crms_find_row_index(SHEET_NAME, "Task Id", task_id)
        if not row_index:
             row_index = sheets_service.crms_find_row_index(SHEET_NAME, "Task ID", task_id)
             
        if not row_index:
            raise HTTPException(status_code=404, detail="Task not found")
        
        sheets_service.crms_delete_row(SHEET_NAME, row_index)
        return {"success": True, "message": "Task deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting task: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
