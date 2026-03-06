"""
Pydantic models for Performance Management System.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# ── Rating Scale ──────────────────────────────────────────────
RATING_SCALE = {
    5: "EXCEEDS ALL EXPECTATIONS",
    4: "EXCEEDS SOME EXPECTATIONS",
    3: "MEETS ALL EXPECTATIONS",
    2: "MEETS SOME EXPECTATIONS",
    1: "NEEDS IMPROVEMENT",
}


# ── Goal Template Models ─────────────────────────────────────
class TemplateGoal(BaseModel):
    goal_id: str = ""
    category_id: str = ""
    template_id: str = ""
    description: str
    expected_outcome: str = ""
    target_metric: Optional[str] = ""
    is_mandatory: bool = True


class TemplateCategory(BaseModel):
    category_id: str = ""
    template_id: str = ""
    name: str
    weight: float  # percentage, all categories in a template must sum to 100
    sort_order: int = 0
    goals: Optional[List[TemplateGoal]] = []


class GoalTemplate(BaseModel):
    template_id: str = ""
    name: str
    designation_id: str = ""
    year: int
    version: int = 1
    is_active: bool = True
    created_by: str = ""
    created_at: str = ""
    categories: Optional[List[TemplateCategory]] = []


class CloneTemplateRequest(BaseModel):
    source_template_id: str
    new_name: str
    new_designation_id: str = ""
    new_year: int = 0


# ── Appraisal Cycle Models ───────────────────────────────────
class AppraisalCycle(BaseModel):
    cycle_id: str = ""
    name: str
    year: int
    cycle_type: str = "Annual"  # 'Annual' or 'Mid-Year'
    start_date: str = ""
    end_date: str = ""
    status: str = "Draft"  # Draft, Active, Closed
    created_by: str = ""
    created_at: str = ""


class InitiateCycleRequest(BaseModel):
    """Request to generate appraisal docs for a cycle."""
    designation_ids: Optional[List[str]] = []  # empty = all designations with assigned templates


# ── Appraisal Document Models ────────────────────────────────
class AppraisalGoal(BaseModel):
    appraisal_id: str = ""
    goal_id: str = ""
    category_id: str = ""
    category_name: str = ""
    category_weight: float = 0
    description: str = ""
    expected_outcome: str = ""
    target_metric: str = ""
    self_score: Optional[int] = None  # 1-5
    self_comments: str = ""
    mgr_score: Optional[int] = None  # 1-5
    mgr_comments: str = ""
    is_custom: bool = False
    added_by: str = ""


class Appraisal(BaseModel):
    appraisal_id: str = ""
    cycle_id: str = ""
    associate_id: str = ""
    associate_name: str = ""
    designation: str = ""
    department: str = ""
    manager_id: str = ""
    manager_name: str = ""
    template_id: str = ""
    status: str = "Draft"
    # Statuses: Draft, Self-Appraisal Pending, Manager Review Pending,
    #           Pending Acknowledgement, Closed
    overall_self_score: Optional[float] = None
    overall_mgr_score: Optional[float] = None
    self_comments: str = ""
    mgr_feedback: str = ""
    discussion_outcome: str = ""
    submitted_at: str = ""
    reviewed_at: str = ""
    closed_at: str = ""
    created_at: str = ""
    goals: Optional[List[AppraisalGoal]] = []


class SelfSubmitRequest(BaseModel):
    goals: List[AppraisalGoal]
    self_comments: str = ""


class ManagerSubmitRequest(BaseModel):
    goals: List[AppraisalGoal]
    mgr_feedback: str = ""


class AcknowledgeRequest(BaseModel):
    discussion_outcome: str = ""


class AddCustomGoalRequest(BaseModel):
    category_id: str
    description: str
    expected_outcome: str = ""
    target_metric: str = ""


# ── Audit Log ────────────────────────────────────────────────
class AuditLogEntry(BaseModel):
    log_id: str = ""
    appraisal_id: str = ""
    action: str  # e.g. 'Created', 'Self-Submitted', 'Manager-Reviewed', 'Acknowledged', 'Closed'
    performed_by: str = ""
    timestamp: str = ""
    details: str = ""
