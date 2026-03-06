from pydantic import BaseModel
from typing import Optional, List

class TaskComment(BaseModel):
    id: str
    author_id: str
    author_name: str
    content: str
    created_at: str

class TaskBase(BaseModel):
    related_type: str
    related_id: str
    title: str
    description: str
    comments: List[TaskComment] = []
    due_date: str
    priority: str = "Medium"
    status: str = "Open"
    assigned_to: str

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    related_type: Optional[str] = None
    related_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    comments: Optional[List[TaskComment]] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None

class Task(TaskBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
