"""
Performance Management System (PMS) API router.
Handles goal templates, appraisal cycles, and the full appraisal lifecycle.
"""
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional

from services.google_sheets import sheets_service
from models.performance import (
    GoalTemplate, TemplateCategory, TemplateGoal,
    CloneTemplateRequest, AppraisalCycle, InitiateCycleRequest,
    Appraisal, AppraisalGoal, SelfSubmitRequest, ManagerSubmitRequest,
    AcknowledgeRequest, AddCustomGoalRequest, AuditLogEntry, RATING_SCALE
)
from config import settings
from middleware.auth_middleware import get_current_user, require_admin

logger = logging.getLogger("chrms.performance")
router = APIRouter()

# ── Sheet header definitions ─────────────────────────────────
TEMPLATE_HEADERS = [
    "template_id", "name", "designation_id", "year", "version",
    "is_active", "created_by", "created_at"
]
CATEGORY_HEADERS = [
    "category_id", "template_id", "name", "weight", "sort_order"
]
GOAL_HEADERS = [
    "goal_id", "category_id", "template_id", "description",
    "expected_outcome", "target_metric", "is_mandatory"
]
CYCLE_HEADERS = [
    "cycle_id", "name", "year", "cycle_type", "start_date",
    "end_date", "status", "created_by", "created_at"
]
APPRAISAL_HEADERS = [
    "appraisal_id", "cycle_id", "associate_id", "associate_name",
    "designation", "department", "manager_id", "manager_name",
    "template_id", "status", "overall_self_score", "overall_mgr_score",
    "self_comments", "mgr_feedback", "discussion_outcome",
    "submitted_at", "reviewed_at", "closed_at", "created_at"
]
APPRAISAL_GOAL_HEADERS = [
    "appraisal_id", "goal_id", "category_id", "category_name",
    "category_weight", "description", "expected_outcome", "target_metric",
    "self_score", "self_comments", "mgr_score", "mgr_comments",
    "is_custom", "added_by"
]
AUDIT_HEADERS = [
    "log_id", "appraisal_id", "action", "performed_by", "timestamp", "details"
]


def _ensure_sheets():
    """Create all PMS sheets if they don't exist."""
    sheets_service.pms_create_sheet_if_not_exists(settings.PMS_TEMPLATES_SHEET, TEMPLATE_HEADERS)
    sheets_service.pms_create_sheet_if_not_exists(settings.PMS_CATEGORIES_SHEET, CATEGORY_HEADERS)
    sheets_service.pms_create_sheet_if_not_exists(settings.PMS_GOALS_SHEET, GOAL_HEADERS)
    sheets_service.pms_create_sheet_if_not_exists(settings.PMS_CYCLES_SHEET, CYCLE_HEADERS)
    sheets_service.pms_create_sheet_if_not_exists(settings.PMS_APPRAISALS_SHEET, APPRAISAL_HEADERS)
    sheets_service.pms_create_sheet_if_not_exists(settings.PMS_APPRAISAL_GOALS_SHEET, APPRAISAL_GOAL_HEADERS)
    sheets_service.pms_create_sheet_if_not_exists(settings.PMS_AUDIT_LOG_SHEET, AUDIT_HEADERS)


def _gen_id(prefix: str = "PMS") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def _now() -> str:
    return datetime.utcnow().isoformat()


def _log_audit(appraisal_id: str, action: str, performed_by: str, details: str = ""):
    try:
        sheets_service.pms_append_row(settings.PMS_AUDIT_LOG_SHEET, [
            _gen_id("LOG"), appraisal_id, action, performed_by, _now(), details
        ])
    except Exception as e:
        logger.error(f"Audit log failed: {e}")


def _calc_weighted_score(goals: list, score_field: str) -> Optional[float]:
    """Calculate weighted overall score from appraisal goals."""
    # Group by category
    categories = {}
    for g in goals:
        cid = g.get("category_id", "") if isinstance(g, dict) else g.category_id
        if cid not in categories:
            weight = float(g.get("category_weight", 0) if isinstance(g, dict) else g.category_weight)
            categories[cid] = {"weight": weight, "scores": [], "total": 0}
        score = g.get(score_field, None) if isinstance(g, dict) else getattr(g, score_field, None)
        if score is not None and str(score).strip():
            try:
                categories[cid]["scores"].append(int(score))
            except (ValueError, TypeError):
                pass

    total_score = 0
    total_weight = 0
    for cid, data in categories.items():
        if data["scores"]:
            avg = sum(data["scores"]) / len(data["scores"])
            total_score += avg * (data["weight"] / 100)
            total_weight += data["weight"]

    return round(total_score, 2) if total_weight > 0 else None


# ══════════════════════════════════════════════════════════════
# TEMPLATES
# ══════════════════════════════════════════════════════════════

@router.get("/templates")
async def get_templates(
    year: Optional[int] = None,
    designation_id: Optional[str] = None,
    active_only: bool = False,
    current_user=Depends(get_current_user)
):
    """List all goal templates with optional filters."""
    try:
        _ensure_sheets()
        templates = sheets_service.pms_get_all_records(settings.PMS_TEMPLATES_SHEET)
        categories = sheets_service.pms_get_all_records(settings.PMS_CATEGORIES_SHEET)
        goals = sheets_service.pms_get_all_records(settings.PMS_GOALS_SHEET)

        if year:
            templates = [t for t in templates if str(t.get("year")) == str(year)]
        if designation_id:
            templates = [t for t in templates if t.get("designation_id") == designation_id]
        if active_only:
            templates = [t for t in templates if str(t.get("is_active", "")).lower() in ("true", "1", "yes")]

        # Enrich with categories and goals
        for t in templates:
            tid = t["template_id"]
            t["categories"] = []
            t_cats = [c for c in categories if c.get("template_id") == tid]
            t_cats.sort(key=lambda c: int(c.get("sort_order", 0)))
            for cat in t_cats:
                cat["goals"] = [g for g in goals if g.get("category_id") == cat["category_id"]]
                t["categories"].append(cat)

        return templates
    except Exception as e:
        logger.error(f"Error fetching templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates")
async def create_template(template: GoalTemplate, current_user=Depends(require_admin)):
    """Create a new goal template with categories and goals."""
    try:
        _ensure_sheets()
        tid = _gen_id("TPL")
        now = _now()

        # Validate category weights
        if template.categories:
            total_wt = sum(c.weight for c in template.categories)
            if abs(total_wt - 100) > 0.01:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category weights must sum to 100%. Current total: {total_wt}%"
                )

        # Insert template header
        sheets_service.pms_append_row(settings.PMS_TEMPLATES_SHEET, [
            tid, template.name, template.designation_id, template.year,
            template.version, str(template.is_active), current_user.email, now
        ])

        # Insert categories and goals
        cat_rows = []
        goal_rows = []
        for idx, cat in enumerate(template.categories or []):
            cid = _gen_id("CAT")
            cat_rows.append([cid, tid, cat.name, cat.weight, idx])
            for goal in (cat.goals or []):
                gid = _gen_id("GOL")
                goal_rows.append([
                    gid, cid, tid, goal.description,
                    goal.expected_outcome, goal.target_metric or "",
                    str(goal.is_mandatory)
                ])

        if cat_rows:
            sheets_service.pms_append_rows(settings.PMS_CATEGORIES_SHEET, cat_rows)
        if goal_rows:
            sheets_service.pms_append_rows(settings.PMS_GOALS_SHEET, goal_rows)

        return {"success": True, "template_id": tid, "message": "Template created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/templates/{template_id}")
async def update_template(template_id: str, template: GoalTemplate, current_user=Depends(require_admin)):
    """Update an existing template (header only — categories/goals have their own endpoints)."""
    try:
        row_idx = sheets_service.pms_find_row_index(settings.PMS_TEMPLATES_SHEET, "template_id", template_id)
        if not row_idx:
            raise HTTPException(status_code=404, detail="Template not found")

        sheets_service.pms_update_row(settings.PMS_TEMPLATES_SHEET, row_idx, [
            template_id, template.name, template.designation_id, template.year,
            template.version, str(template.is_active), template.created_by, template.created_at
        ])
        return {"success": True, "message": "Template updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates/{template_id}/clone")
async def clone_template(template_id: str, req: CloneTemplateRequest, current_user=Depends(require_admin)):
    """Clone a template to another designation/year, preserving structure."""
    try:
        _ensure_sheets()
        # Get source template
        src = sheets_service.pms_get_row_by_id(settings.PMS_TEMPLATES_SHEET, "template_id", template_id)
        if not src:
            raise HTTPException(status_code=404, detail="Source template not found")

        new_tid = _gen_id("TPL")
        now = _now()
        new_year = req.new_year if req.new_year else src.get("year")
        new_desig = req.new_designation_id if req.new_designation_id else src.get("designation_id")

        sheets_service.pms_append_row(settings.PMS_TEMPLATES_SHEET, [
            new_tid, req.new_name, new_desig, new_year,
            1, "True", current_user.email, now
        ])

        # Clone categories and goals
        all_cats = sheets_service.pms_get_all_records(settings.PMS_CATEGORIES_SHEET)
        all_goals = sheets_service.pms_get_all_records(settings.PMS_GOALS_SHEET)
        src_cats = [c for c in all_cats if c.get("template_id") == template_id]

        cat_rows = []
        goal_rows = []
        for cat in src_cats:
            new_cid = _gen_id("CAT")
            cat_rows.append([new_cid, new_tid, cat["name"], cat["weight"], cat.get("sort_order", 0)])
            src_goals = [g for g in all_goals if g.get("category_id") == cat["category_id"]]
            for goal in src_goals:
                new_gid = _gen_id("GOL")
                goal_rows.append([
                    new_gid, new_cid, new_tid, goal["description"],
                    goal.get("expected_outcome", ""), goal.get("target_metric", ""),
                    goal.get("is_mandatory", "True")
                ])

        if cat_rows:
            sheets_service.pms_append_rows(settings.PMS_CATEGORIES_SHEET, cat_rows)
        if goal_rows:
            sheets_service.pms_append_rows(settings.PMS_GOALS_SHEET, goal_rows)

        return {"success": True, "template_id": new_tid, "message": "Template cloned successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cloning template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, current_user=Depends(require_admin)):
    """Delete a template and its categories/goals."""
    try:
        row_idx = sheets_service.pms_find_row_index(settings.PMS_TEMPLATES_SHEET, "template_id", template_id)
        if not row_idx:
            raise HTTPException(status_code=404, detail="Template not found")

        # Delete goals
        all_goals = sheets_service.pms_get_all_records(settings.PMS_GOALS_SHEET)
        for goal in reversed([g for g in all_goals if g.get("template_id") == template_id]):
            gidx = sheets_service.pms_find_row_index(settings.PMS_GOALS_SHEET, "goal_id", goal["goal_id"])
            if gidx:
                sheets_service.pms_delete_row(settings.PMS_GOALS_SHEET, gidx)

        # Delete categories
        all_cats = sheets_service.pms_get_all_records(settings.PMS_CATEGORIES_SHEET)
        for cat in reversed([c for c in all_cats if c.get("template_id") == template_id]):
            cidx = sheets_service.pms_find_row_index(settings.PMS_CATEGORIES_SHEET, "category_id", cat["category_id"])
            if cidx:
                sheets_service.pms_delete_row(settings.PMS_CATEGORIES_SHEET, cidx)

        # Delete template
        sheets_service.pms_delete_row(settings.PMS_TEMPLATES_SHEET, row_idx)
        return {"success": True, "message": "Template deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════
# CYCLES
# ══════════════════════════════════════════════════════════════

@router.get("/cycles")
async def get_cycles(year: Optional[int] = None, current_user=Depends(get_current_user)):
    """List appraisal cycles."""
    try:
        _ensure_sheets()
        cycles = sheets_service.pms_get_all_records(settings.PMS_CYCLES_SHEET)
        if year:
            cycles = [c for c in cycles if str(c.get("year")) == str(year)]
        return cycles
    except Exception as e:
        logger.error(f"Error fetching cycles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cycles")
async def create_cycle(cycle: AppraisalCycle, current_user=Depends(require_admin)):
    """Create a new appraisal cycle."""
    try:
        _ensure_sheets()
        cid = _gen_id("CYC")
        now = _now()
        sheets_service.pms_append_row(settings.PMS_CYCLES_SHEET, [
            cid, cycle.name, cycle.year, cycle.cycle_type,
            cycle.start_date, cycle.end_date, "Draft",
            current_user.email, now
        ])
        return {"success": True, "cycle_id": cid, "message": "Cycle created"}
    except Exception as e:
        logger.error(f"Error creating cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/cycles/{cycle_id}")
async def update_cycle(cycle_id: str, cycle: AppraisalCycle, current_user=Depends(require_admin)):
    """Update cycle details or status."""
    try:
        row_idx = sheets_service.pms_find_row_index(settings.PMS_CYCLES_SHEET, "cycle_id", cycle_id)
        if not row_idx:
            raise HTTPException(status_code=404, detail="Cycle not found")
        existing = sheets_service.pms_get_row_by_id(settings.PMS_CYCLES_SHEET, "cycle_id", cycle_id)
        sheets_service.pms_update_row(settings.PMS_CYCLES_SHEET, row_idx, [
            cycle_id, cycle.name or existing.get("name", ""),
            cycle.year or existing.get("year", ""),
            cycle.cycle_type or existing.get("cycle_type", ""),
            cycle.start_date or existing.get("start_date", ""),
            cycle.end_date or existing.get("end_date", ""),
            cycle.status or existing.get("status", ""),
            existing.get("created_by", ""),
            existing.get("created_at", "")
        ])
        return {"success": True, "message": "Cycle updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cycles/{cycle_id}/initiate")
async def initiate_cycle(cycle_id: str, req: InitiateCycleRequest, current_user=Depends(require_admin)):
    """Generate appraisal documents for all eligible associates in this cycle."""
    try:
        _ensure_sheets()
        cycle = sheets_service.pms_get_row_by_id(settings.PMS_CYCLES_SHEET, "cycle_id", cycle_id)
        if not cycle:
            raise HTTPException(status_code=404, detail="Cycle not found")

        cycle_year = str(cycle.get("year", ""))

        # Get all active templates for this year
        templates = sheets_service.pms_get_all_records(settings.PMS_TEMPLATES_SHEET)
        active_templates = [
            t for t in templates
            if str(t.get("year")) == cycle_year and str(t.get("is_active", "")).lower() in ("true", "1", "yes")
        ]

        if req.designation_ids:
            active_templates = [t for t in active_templates if t.get("designation_id") in req.designation_ids]

        if not active_templates:
            raise HTTPException(status_code=400, detail="No active templates found for the given criteria")

        # Build a designation → template map
        desig_template_map = {}
        for t in active_templates:
            desig_template_map[t["designation_id"]] = t

        # Get all associates
        associates = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)

        # Get existing appraisals for this cycle to avoid duplicates
        existing_appraisals = sheets_service.pms_get_all_records(settings.PMS_APPRAISALS_SHEET)
        existing_assoc_ids = set(
            a.get("associate_id") for a in existing_appraisals if a.get("cycle_id") == cycle_id
        )

        # Get all categories and goals for templates
        all_categories = sheets_service.pms_get_all_records(settings.PMS_CATEGORIES_SHEET)
        all_goals = sheets_service.pms_get_all_records(settings.PMS_GOALS_SHEET)

        appraisal_rows = []
        goal_rows = []
        count = 0

        for assoc in associates:
            assoc_id = assoc.get("Associate ID", "").strip()
            if not assoc_id or assoc_id in existing_assoc_ids:
                continue

            desig_id = str(assoc.get("Designation ID", "") or assoc.get("Designation", "")).strip()
            template = desig_template_map.get(desig_id)
            if not template:
                continue

            tid = template["template_id"]
            appraisal_id = _gen_id("APR")
            now = _now()

            # Get manager info
            manager_id = assoc.get("Manager ID", "") or assoc.get("Reporting Manager", "")
            manager_name = ""
            if manager_id:
                mgr = next((a for a in associates if a.get("Associate ID", "").strip() == str(manager_id).strip()), None)
                if mgr:
                    manager_name = mgr.get("Associate Name", "")

            appraisal_rows.append([
                appraisal_id, cycle_id, assoc_id,
                assoc.get("Associate Name", ""),
                desig_id,
                assoc.get("Department ID", "") or assoc.get("Department", ""),
                str(manager_id).strip(), manager_name, tid,
                "Self-Appraisal Pending",
                "", "", "", "", "", "", "", "", now
            ])

            # Populate goals from template
            t_cats = [c for c in all_categories if c.get("template_id") == tid]
            for cat in t_cats:
                cat_goals = [g for g in all_goals if g.get("category_id") == cat["category_id"]]
                for goal in cat_goals:
                    goal_rows.append([
                        appraisal_id, goal["goal_id"], cat["category_id"],
                        cat["name"], cat.get("weight", 0),
                        goal["description"], goal.get("expected_outcome", ""),
                        goal.get("target_metric", ""),
                        "", "", "", "", "False", ""
                    ])

            count += 1

        if appraisal_rows:
            sheets_service.pms_append_rows(settings.PMS_APPRAISALS_SHEET, appraisal_rows)
        if goal_rows:
            sheets_service.pms_append_rows(settings.PMS_APPRAISAL_GOALS_SHEET, goal_rows)

        # Update cycle status to Active
        cycle_row_idx = sheets_service.pms_find_row_index(settings.PMS_CYCLES_SHEET, "cycle_id", cycle_id)
        if cycle_row_idx:
            existing_cycle = sheets_service.pms_get_row_by_id(settings.PMS_CYCLES_SHEET, "cycle_id", cycle_id)
            sheets_service.pms_update_row(settings.PMS_CYCLES_SHEET, cycle_row_idx, [
                cycle_id, existing_cycle.get("name", ""), existing_cycle.get("year", ""),
                existing_cycle.get("cycle_type", ""), existing_cycle.get("start_date", ""),
                existing_cycle.get("end_date", ""), "Active",
                existing_cycle.get("created_by", ""), existing_cycle.get("created_at", "")
            ])

        return {
            "success": True,
            "message": f"Initiated {count} appraisals for cycle {cycle_id}",
            "count": count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════
# APPRAISALS
# ══════════════════════════════════════════════════════════════

@router.get("/appraisals")
async def get_appraisals(
    cycle_id: Optional[str] = None,
    associate_id: Optional[str] = None,
    status: Optional[str] = None,
    manager_id: Optional[str] = None,
    current_user=Depends(get_current_user)
):
    """List appraisals with optional filters."""
    try:
        _ensure_sheets()
        appraisals = sheets_service.pms_get_all_records(settings.PMS_APPRAISALS_SHEET)
        if cycle_id:
            appraisals = [a for a in appraisals if a.get("cycle_id") == cycle_id]
        if associate_id:
            appraisals = [a for a in appraisals if a.get("associate_id") == associate_id]
        if status:
            appraisals = [a for a in appraisals if a.get("status") == status]
        if manager_id:
            appraisals = [a for a in appraisals if a.get("manager_id") == manager_id]
        return appraisals
    except Exception as e:
        logger.error(f"Error fetching appraisals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/appraisals/{appraisal_id}")
async def get_appraisal(appraisal_id: str, current_user=Depends(get_current_user)):
    """Get full appraisal document with all goals."""
    try:
        _ensure_sheets()
        appraisal = sheets_service.pms_get_row_by_id(
            settings.PMS_APPRAISALS_SHEET, "appraisal_id", appraisal_id
        )
        if not appraisal:
            raise HTTPException(status_code=404, detail="Appraisal not found")

        # Get goals
        all_goals = sheets_service.pms_get_all_records(settings.PMS_APPRAISAL_GOALS_SHEET)
        appraisal["goals"] = [g for g in all_goals if g.get("appraisal_id") == appraisal_id]

        # Get audit log
        all_logs = sheets_service.pms_get_all_records(settings.PMS_AUDIT_LOG_SHEET)
        appraisal["audit_log"] = [l for l in all_logs if l.get("appraisal_id") == appraisal_id]

        return appraisal
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching appraisal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/appraisals/{appraisal_id}/self-submit")
async def self_submit(appraisal_id: str, req: SelfSubmitRequest, current_user=Depends(get_current_user)):
    """Associate submits self-appraisal scores and comments."""
    try:
        appraisal = sheets_service.pms_get_row_by_id(
            settings.PMS_APPRAISALS_SHEET, "appraisal_id", appraisal_id
        )
        if not appraisal:
            raise HTTPException(status_code=404, detail="Appraisal not found")
        if appraisal.get("status") != "Self-Appraisal Pending":
            raise HTTPException(status_code=400, detail="Appraisal is not in self-appraisal stage")

        # Update each goal's self scores
        for goal_data in req.goals:
            gid = goal_data.goal_id
            row_idx = None
            all_goals = sheets_service.pms_get_all_records(settings.PMS_APPRAISAL_GOALS_SHEET)
            for g in all_goals:
                if g.get("appraisal_id") == appraisal_id and g.get("goal_id") == gid:
                    row_idx = sheets_service.pms_find_row_index(
                        settings.PMS_APPRAISAL_GOALS_SHEET, "goal_id", gid
                    )
                    # Find the specific row for this appraisal
                    sheet = sheets_service.get_pms_sheet(settings.PMS_APPRAISAL_GOALS_SHEET)
                    rows = sheet.get_all_values()
                    headers = [str(h).strip() for h in rows[0]]
                    apr_col = headers.index("appraisal_id")
                    gid_col = headers.index("goal_id")
                    for idx, row in enumerate(rows[1:]):
                        if (idx + 1 < len(rows) and
                            str(row[apr_col]).strip() == appraisal_id and
                            str(row[gid_col]).strip() == gid):
                            row_idx = idx + 2
                            break
                    break

            if row_idx:
                existing = sheets_service.pms_get_all_records(settings.PMS_APPRAISAL_GOALS_SHEET, use_cache=False)
                for g in existing:
                    if g.get("appraisal_id") == appraisal_id and g.get("goal_id") == gid:
                        sheets_service.pms_update_row(settings.PMS_APPRAISAL_GOALS_SHEET, row_idx, [
                            appraisal_id, gid, g.get("category_id", ""),
                            g.get("category_name", ""), g.get("category_weight", ""),
                            g.get("description", ""), g.get("expected_outcome", ""),
                            g.get("target_metric", ""),
                            goal_data.self_score or "", goal_data.self_comments or "",
                            g.get("mgr_score", ""), g.get("mgr_comments", ""),
                            g.get("is_custom", "False"), g.get("added_by", "")
                        ])
                        break

        # Calculate overall self score
        updated_goals = [g for g in sheets_service.pms_get_all_records(settings.PMS_APPRAISAL_GOALS_SHEET, use_cache=False)
                         if g.get("appraisal_id") == appraisal_id]
        overall_self = _calc_weighted_score(updated_goals, "self_score")

        # Update appraisal status
        apr_row = sheets_service.pms_find_row_index(settings.PMS_APPRAISALS_SHEET, "appraisal_id", appraisal_id)
        now = _now()
        sheets_service.pms_update_row(settings.PMS_APPRAISALS_SHEET, apr_row, [
            appraisal_id, appraisal.get("cycle_id", ""), appraisal.get("associate_id", ""),
            appraisal.get("associate_name", ""), appraisal.get("designation", ""),
            appraisal.get("department", ""), appraisal.get("manager_id", ""),
            appraisal.get("manager_name", ""), appraisal.get("template_id", ""),
            "Manager Review Pending",
            str(overall_self) if overall_self else "", appraisal.get("overall_mgr_score", ""),
            req.self_comments, appraisal.get("mgr_feedback", ""),
            appraisal.get("discussion_outcome", ""),
            now, appraisal.get("reviewed_at", ""), appraisal.get("closed_at", ""),
            appraisal.get("created_at", "")
        ])

        _log_audit(appraisal_id, "Self-Submitted", current_user.email,
                    f"Overall self score: {overall_self}")

        return {"success": True, "message": "Self-appraisal submitted", "overall_self_score": overall_self}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in self-submit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/appraisals/{appraisal_id}/manager-submit")
async def manager_submit(appraisal_id: str, req: ManagerSubmitRequest, current_user=Depends(get_current_user)):
    """Manager submits review scores and feedback."""
    try:
        appraisal = sheets_service.pms_get_row_by_id(
            settings.PMS_APPRAISALS_SHEET, "appraisal_id", appraisal_id
        )
        if not appraisal:
            raise HTTPException(status_code=404, detail="Appraisal not found")
        if appraisal.get("status") != "Manager Review Pending":
            raise HTTPException(status_code=400, detail="Appraisal is not in manager review stage")

        # Update each goal's manager scores
        for goal_data in req.goals:
            gid = goal_data.goal_id
            sheet = sheets_service.get_pms_sheet(settings.PMS_APPRAISAL_GOALS_SHEET)
            rows = sheet.get_all_values()
            headers = [str(h).strip() for h in rows[0]]
            apr_col = headers.index("appraisal_id")
            gid_col = headers.index("goal_id")
            row_idx = None
            for idx, row in enumerate(rows[1:]):
                if (str(row[apr_col]).strip() == appraisal_id and
                    str(row[gid_col]).strip() == gid):
                    row_idx = idx + 2
                    break

            if row_idx:
                existing = sheets_service.pms_get_all_records(settings.PMS_APPRAISAL_GOALS_SHEET, use_cache=False)
                for g in existing:
                    if g.get("appraisal_id") == appraisal_id and g.get("goal_id") == gid:
                        sheets_service.pms_update_row(settings.PMS_APPRAISAL_GOALS_SHEET, row_idx, [
                            appraisal_id, gid, g.get("category_id", ""),
                            g.get("category_name", ""), g.get("category_weight", ""),
                            g.get("description", ""), g.get("expected_outcome", ""),
                            g.get("target_metric", ""),
                            g.get("self_score", ""), g.get("self_comments", ""),
                            goal_data.mgr_score or "", goal_data.mgr_comments or "",
                            g.get("is_custom", "False"), g.get("added_by", "")
                        ])
                        break

        # Calculate overall manager score
        updated_goals = [g for g in sheets_service.pms_get_all_records(settings.PMS_APPRAISAL_GOALS_SHEET, use_cache=False)
                         if g.get("appraisal_id") == appraisal_id]
        overall_mgr = _calc_weighted_score(updated_goals, "mgr_score")

        # Update appraisal status
        apr_row = sheets_service.pms_find_row_index(settings.PMS_APPRAISALS_SHEET, "appraisal_id", appraisal_id)
        now = _now()
        sheets_service.pms_update_row(settings.PMS_APPRAISALS_SHEET, apr_row, [
            appraisal_id, appraisal.get("cycle_id", ""), appraisal.get("associate_id", ""),
            appraisal.get("associate_name", ""), appraisal.get("designation", ""),
            appraisal.get("department", ""), appraisal.get("manager_id", ""),
            appraisal.get("manager_name", ""), appraisal.get("template_id", ""),
            "Pending Acknowledgement",
            appraisal.get("overall_self_score", ""), str(overall_mgr) if overall_mgr else "",
            appraisal.get("self_comments", ""), req.mgr_feedback,
            appraisal.get("discussion_outcome", ""),
            appraisal.get("submitted_at", ""), now, appraisal.get("closed_at", ""),
            appraisal.get("created_at", "")
        ])

        _log_audit(appraisal_id, "Manager-Reviewed", current_user.email,
                    f"Overall manager score: {overall_mgr}")

        return {"success": True, "message": "Manager review submitted", "overall_mgr_score": overall_mgr}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in manager-submit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/appraisals/{appraisal_id}/acknowledge")
async def acknowledge(appraisal_id: str, req: AcknowledgeRequest, current_user=Depends(get_current_user)):
    """Associate acknowledges manager review and closes appraisal."""
    try:
        appraisal = sheets_service.pms_get_row_by_id(
            settings.PMS_APPRAISALS_SHEET, "appraisal_id", appraisal_id
        )
        if not appraisal:
            raise HTTPException(status_code=404, detail="Appraisal not found")
        if appraisal.get("status") != "Pending Acknowledgement":
            raise HTTPException(status_code=400, detail="Appraisal is not in acknowledgement stage")

        apr_row = sheets_service.pms_find_row_index(settings.PMS_APPRAISALS_SHEET, "appraisal_id", appraisal_id)
        now = _now()
        sheets_service.pms_update_row(settings.PMS_APPRAISALS_SHEET, apr_row, [
            appraisal_id, appraisal.get("cycle_id", ""), appraisal.get("associate_id", ""),
            appraisal.get("associate_name", ""), appraisal.get("designation", ""),
            appraisal.get("department", ""), appraisal.get("manager_id", ""),
            appraisal.get("manager_name", ""), appraisal.get("template_id", ""),
            "Closed",
            appraisal.get("overall_self_score", ""), appraisal.get("overall_mgr_score", ""),
            appraisal.get("self_comments", ""), appraisal.get("mgr_feedback", ""),
            req.discussion_outcome,
            appraisal.get("submitted_at", ""), appraisal.get("reviewed_at", ""), now,
            appraisal.get("created_at", "")
        ])

        _log_audit(appraisal_id, "Acknowledged-Closed", current_user.email,
                    f"Discussion: {req.discussion_outcome[:100]}")

        return {"success": True, "message": "Appraisal closed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in acknowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/appraisals/{appraisal_id}/goals")
async def add_custom_goal(appraisal_id: str, req: AddCustomGoalRequest, current_user=Depends(get_current_user)):
    """Associate adds a custom goal to their appraisal."""
    try:
        appraisal = sheets_service.pms_get_row_by_id(
            settings.PMS_APPRAISALS_SHEET, "appraisal_id", appraisal_id
        )
        if not appraisal:
            raise HTTPException(status_code=404, detail="Appraisal not found")
        if appraisal.get("status") not in ("Self-Appraisal Pending", "Draft"):
            raise HTTPException(status_code=400, detail="Cannot add goals at this stage")

        # Get category info
        all_goals = sheets_service.pms_get_all_records(settings.PMS_APPRAISAL_GOALS_SHEET)
        cat_goals = [g for g in all_goals if g.get("appraisal_id") == appraisal_id and g.get("category_id") == req.category_id]
        cat_name = cat_goals[0].get("category_name", "") if cat_goals else ""
        cat_weight = cat_goals[0].get("category_weight", 0) if cat_goals else 0

        new_gid = _gen_id("GOL")
        sheets_service.pms_append_row(settings.PMS_APPRAISAL_GOALS_SHEET, [
            appraisal_id, new_gid, req.category_id, cat_name, cat_weight,
            req.description, req.expected_outcome, req.target_metric,
            "", "", "", "", "True", current_user.email
        ])

        _log_audit(appraisal_id, "Custom-Goal-Added", current_user.email,
                    f"Goal: {req.description[:80]}")

        return {"success": True, "goal_id": new_gid, "message": "Custom goal added"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding custom goal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════
# DASHBOARD & REPORTING
# ══════════════════════════════════════════════════════════════

@router.get("/dashboard/admin")
async def admin_dashboard(cycle_id: Optional[str] = None, current_user=Depends(get_current_user)):
    """Admin dashboard: cycle status overview."""
    try:
        _ensure_sheets()
        appraisals = sheets_service.pms_get_all_records(settings.PMS_APPRAISALS_SHEET)
        if cycle_id:
            appraisals = [a for a in appraisals if a.get("cycle_id") == cycle_id]

        statuses = {}
        departments = {}
        for a in appraisals:
            st = a.get("status", "Unknown")
            statuses[st] = statuses.get(st, 0) + 1
            dept = a.get("department", "Unknown")
            if dept not in departments:
                departments[dept] = {"total": 0, "statuses": {}}
            departments[dept]["total"] += 1
            departments[dept]["statuses"][st] = departments[dept]["statuses"].get(st, 0) + 1

        return {
            "total": len(appraisals),
            "status_breakdown": statuses,
            "department_breakdown": departments
        }
    except Exception as e:
        logger.error(f"Error in admin dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/manager")
async def manager_dashboard(current_user=Depends(get_current_user)):
    """Manager dashboard: direct reportees with appraisal stage."""
    try:
        _ensure_sheets()
        appraisals = sheets_service.pms_get_all_records(settings.PMS_APPRAISALS_SHEET)
        # Filter by manager
        my_appraisals = [a for a in appraisals if a.get("manager_id") == current_user.associate_id]
        return my_appraisals
    except Exception as e:
        logger.error(f"Error in manager dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/export")
async def export_appraisals(
    cycle_id: Optional[str] = None,
    current_user=Depends(require_admin)
):
    """Export appraisal data as JSON (frontend can convert to CSV)."""
    try:
        _ensure_sheets()
        appraisals = sheets_service.pms_get_all_records(settings.PMS_APPRAISALS_SHEET)
        all_goals = sheets_service.pms_get_all_records(settings.PMS_APPRAISAL_GOALS_SHEET)

        if cycle_id:
            appraisals = [a for a in appraisals if a.get("cycle_id") == cycle_id]

        export_data = []
        for a in appraisals:
            a_goals = [g for g in all_goals if g.get("appraisal_id") == a.get("appraisal_id")]
            export_data.append({**a, "goals": a_goals})

        return export_data
    except Exception as e:
        logger.error(f"Error exporting appraisals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rating-scale")
async def get_rating_scale():
    """Return the 5-point rating scale."""
    return [{"score": k, "label": v} for k, v in RATING_SCALE.items()]
