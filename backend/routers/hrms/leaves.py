from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
import logging

from services.google_sheets import sheets_service
from services.email_service import email_service
from models.hrms.leave_application import (
    LeaveApplication, LeaveApplicationCreate,
    leave_application_to_row, row_to_leave_application, LEAVE_APPLICATION_COLUMNS
)
from models.hrms.timesheet import TimesheetCreate, timesheet_to_row, TIMESHEET_COLUMNS
from models.hrms.associate import row_to_associate
from config import settings
from middleware.auth_middleware import get_current_user, require_admin, TokenData
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helper: compute business days between two dates ──────────────────
def _count_leave_days(from_date: str, to_date: str, half_day: bool) -> float:
    """Count business days (Mon-Fri) between two dates inclusive."""
    try:
        start = datetime.strptime(from_date, "%Y-%m-%d")
        end = datetime.strptime(to_date, "%Y-%m-%d")
    except Exception:
        return 1.0

    if half_day:
        return 0.5

    days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:  # Mon-Fri
            days += 1
        current += timedelta(days=1)
    return float(days)


# ── GET /  — list leave applications ────────────────────────────────
@router.get("/", response_model=List[LeaveApplication])
async def get_leave_applications(
    associate_id: Optional[str] = None,
    status: Optional[str] = None,
    year: Optional[int] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """Get leave applications with optional filters."""
    try:
        sheets_service.create_sheet_if_not_exists(
            settings.LEAVE_APPLICATIONS_SHEET, LEAVE_APPLICATION_COLUMNS
        )
        records = sheets_service.get_all_records(settings.LEAVE_APPLICATIONS_SHEET)
        results = []

        for idx, r in enumerate(records):
            if not r.get("Leave ID"):
                continue
            if associate_id and str(r.get("Associate ID", "")).strip() != associate_id:
                continue
            if status and str(r.get("Status", "")).strip().lower() != status.lower():
                continue
            if year:
                from_date = str(r.get("From Date", ""))
                try:
                    if datetime.strptime(from_date, "%Y-%m-%d").year != year:
                        continue
                except Exception:
                    continue

            results.append(row_to_leave_application(r, idx + 2))

        # Sort by applied date descending
        results.sort(key=lambda x: x.applied_on or "", reverse=True)
        return results
    except Exception as e:
        logger.error(f"Error fetching leave applications: {e}")
        return []


# ── POST /  — apply for leave ────────────────────────────────────────
@router.post("/", response_model=dict)
async def apply_leave(
    application: LeaveApplicationCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Apply for leave. Sends email to supervisor."""
    try:
        sheets_service.create_sheet_if_not_exists(
            settings.LEAVE_APPLICATIONS_SHEET, LEAVE_APPLICATION_COLUMNS
        )

        # Calculate total days
        total_days = _count_leave_days(application.from_date, application.to_date, application.half_day)
        application.total_days = total_days
        application.status = "Pending"
        application.applied_on = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        leave_id = f"LV-{uuid.uuid4().hex[:8].upper()}"
        row = leave_application_to_row(application, leave_id)
        sheets_service.append_row(settings.LEAVE_APPLICATIONS_SHEET, row)

        # Send email to supervisor
        try:
            assoc_record = sheets_service.get_row_by_id(
                settings.ASSOCIATES_SHEET, "Associate ID", application.associate_id.strip()
            )
            if assoc_record:
                manager_id = str(assoc_record.get("Manager", "")).strip()
                if manager_id:
                    # Find manager's email
                    mgr_record = sheets_service.get_row_by_id(
                        settings.ASSOCIATES_SHEET, "Associate ID", manager_id
                    )
                    if mgr_record:
                        mgr_email = str(mgr_record.get("Email", "")).strip()
                        mgr_name = str(mgr_record.get("Associate Name", "")).strip()
                        if mgr_email:
                            half_day_info = ""
                            if application.half_day:
                                period = "First Half" if application.half_day_period == "first_half" else "Second Half"
                                half_day_info = f" (Half Day - {period})"

                            subject = f"Leave Application: {application.associate_name}"
                            body = f"""
<html>
<body style="font-family: 'Segoe UI', sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
<div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 24px; border-radius: 12px 12px 0 0;">
    <h2 style="color: white; margin: 0;">📋 Leave Application</h2>
</div>
<div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
    <p>Hi {mgr_name},</p>
    <p><strong>{application.associate_name}</strong> has applied for leave and requires your approval.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: 600; color: #64748b;">Leave Type</td><td style="padding: 8px;">{application.leave_type_code}</td></tr>
        <tr style="background: #f1f5f9;"><td style="padding: 8px; font-weight: 600; color: #64748b;">From</td><td style="padding: 8px;">{application.from_date}</td></tr>
        <tr><td style="padding: 8px; font-weight: 600; color: #64748b;">To</td><td style="padding: 8px;">{application.to_date}{half_day_info}</td></tr>
        <tr style="background: #f1f5f9;"><td style="padding: 8px; font-weight: 600; color: #64748b;">Total Days</td><td style="padding: 8px;">{total_days}</td></tr>
        <tr><td style="padding: 8px; font-weight: 600; color: #64748b;">Reason</td><td style="padding: 8px;">{application.reason or 'N/A'}</td></tr>
    </table>
    <p style="color: #64748b; font-size: 0.875rem;">Please log in to the portal to approve or reject this application.</p>
</div>
</body>
</html>
"""
                            await email_service.send_email(mgr_email, subject, body, html=True)
        except Exception as email_err:
            logger.error(f"Failed to send leave notification email: {email_err}")

        return {"success": True, "id": leave_id, "message": f"Leave applied successfully ({total_days} days)"}
    except Exception as e:
        logger.error(f"Error applying leave: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /balance/{associate_id}  — get leave balance ─────────────────
@router.get("/balance/{associate_id}", response_model=dict)
async def get_leave_balance(
    associate_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get leave balance for an associate: entitlement - used per leave type."""
    try:
        current_year = datetime.now().year

        # 1. Get associate info (join_date for experience calc)
        assoc_record = sheets_service.get_row_by_id(
            settings.ASSOCIATES_SHEET, "Associate ID", associate_id.strip()
        )
        if not assoc_record:
            raise HTTPException(status_code=404, detail="Associate not found")

        associate = row_to_associate(assoc_record)

        # Calculate years of experience from join date
        years_exp = 0
        try:
            from utils.date_utils import parse_date_from_sheet
            join_dt = parse_date_from_sheet(associate.join_date)
            if join_dt:
                years_exp = (datetime.now() - join_dt).days // 365
        except Exception:
            pass

        # 2. Get leave groups (leave types)
        sheets_service.create_sheet_if_not_exists(settings.SETTINGS_LEAVE_GROUPS_SHEET, ["code", "name", "description"])
        leave_groups = sheets_service.get_all_records(settings.SETTINGS_LEAVE_GROUPS_SHEET)

        # 3. Get entitlements 
        sheets_service.create_sheet_if_not_exists(settings.SETTINGS_LEAVE_ENTITLEMENTS_SHEET,
            ["group_code", "entitlement_type", "from_year", "to_year", "entitlement_days"])
        entitlements = sheets_service.get_all_records(settings.SETTINGS_LEAVE_ENTITLEMENTS_SHEET)

        # 4. Get used leaves (approved only, current year)
        sheets_service.create_sheet_if_not_exists(
            settings.LEAVE_APPLICATIONS_SHEET, LEAVE_APPLICATION_COLUMNS
        )
        applications = sheets_service.get_all_records(settings.LEAVE_APPLICATIONS_SHEET)

        used_by_type = {}
        for app in applications:
            if str(app.get("Associate ID", "")).strip() != associate_id:
                continue
            if str(app.get("Status", "")).strip().lower() != "approved":
                continue
            try:
                from_date = datetime.strptime(str(app.get("From Date", "")), "%Y-%m-%d")
                if from_date.year != current_year:
                    continue
            except Exception:
                continue
            lt_code = str(app.get("Leave Type Code", "")).strip()
            days = float(app.get("Total Days", 0) or 0)
            used_by_type[lt_code] = used_by_type.get(lt_code, 0) + days

        # 5. Build balance per leave type
        balance = []
        for grp in leave_groups:
            grp_code = str(grp.get("code", "")).strip()
            grp_name = str(grp.get("name", "")).strip()
            if not grp_code:
                continue

            # Find entitlement for this group
            entitled = 0.0
            grp_entitlements = [e for e in entitlements if str(e.get("group_code", "")).strip() == grp_code]

            for ent in grp_entitlements:
                ent_type = str(ent.get("entitlement_type", "common")).strip()
                if ent_type == "common":
                    entitled = float(ent.get("entitlement_days", 0) or 0)
                    break
                elif ent_type == "experience_based":
                    from_yr = int(float(ent.get("from_year", 0) or 0))
                    to_yr = int(float(ent.get("to_year", 999) or 999))
                    if from_yr <= years_exp <= to_yr:
                        entitled = float(ent.get("entitlement_days", 0) or 0)
                        break

            used = used_by_type.get(grp_code, 0)
            balance.append({
                "leave_type_code": grp_code,
                "leave_type_name": grp_name,
                "entitled": entitled,
                "used": used,
                "available": entitled - used
            })

        return {
            "associate_id": associate_id,
            "year": current_year,
            "years_experience": years_exp,
            "balance": balance
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting leave balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /team  — get team leave applications ─────────────────────────
@router.get("/team", response_model=List[LeaveApplication])
async def get_team_leaves(
    status: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """Get leave applications from direct reports."""
    try:
        curr_associate_id = str(current_user.associate_id).strip().lower()
        is_admin = current_user.role.lower() == "admin"

        # Get all associates to find direct reports
        all_associates = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
        direct_report_ids = set()

        for a in all_associates:
            mgr = str(a.get("Manager", "")).strip().lower()
            aid = str(a.get("Associate ID", "")).strip()
            if is_admin or mgr == curr_associate_id:
                direct_report_ids.add(aid)

        if not direct_report_ids:
            return []

        sheets_service.create_sheet_if_not_exists(
            settings.LEAVE_APPLICATIONS_SHEET, LEAVE_APPLICATION_COLUMNS
        )
        records = sheets_service.get_all_records(settings.LEAVE_APPLICATIONS_SHEET)
        results = []

        for idx, r in enumerate(records):
            aid = str(r.get("Associate ID", "")).strip()
            if aid not in direct_report_ids:
                continue
            if status and str(r.get("Status", "")).strip().lower() != status.lower():
                continue
            results.append(row_to_leave_application(r, idx + 2))

        results.sort(key=lambda x: x.applied_on or "", reverse=True)
        return results
    except Exception as e:
        logger.error(f"Error fetching team leaves: {e}")
        return []


# ── POST /{leave_id}/approve  — approve leave ───────────────────────
class LeaveActionRequest(BaseModel):
    remarks: str = ""

@router.post("/{leave_id}/approve", response_model=dict)
async def approve_leave(
    leave_id: str,
    action: LeaveActionRequest = LeaveActionRequest(),
    current_user: TokenData = Depends(get_current_user)
):
    """Approve a leave application. Creates timesheet entries for leave days."""
    try:
        row_idx = sheets_service.find_row_index(
            settings.LEAVE_APPLICATIONS_SHEET, "Leave ID", leave_id
        )
        if not row_idx:
            raise HTTPException(status_code=404, detail="Leave application not found")

        records = sheets_service.get_all_records(settings.LEAVE_APPLICATIONS_SHEET)
        record = records[row_idx - 2]
        app = row_to_leave_application(record, row_idx)

        if app.status != "Pending":
            raise HTTPException(status_code=400, detail=f"Leave is already {app.status}")

        # Update status
        approver_name = current_user.name or current_user.associate_id
        # Status col = 11 (1-indexed: Leave ID=1, AssocID=2, Name=3, Type=4, From=5, To=6, HalfDay=7, Period=8, Reason=9, Days=10, Status=11, Applied=12, ApprovedBy=13, Remarks=14)
        sheets_service.update_cell(settings.LEAVE_APPLICATIONS_SHEET, row_idx, 11, "Approved")
        sheets_service.update_cell(settings.LEAVE_APPLICATIONS_SHEET, row_idx, 13, approver_name)
        if action.remarks:
            sheets_service.update_cell(settings.LEAVE_APPLICATIONS_SHEET, row_idx, 14, action.remarks)

        # Create timesheet entries for leave days
        try:
            sheets_service.create_sheet_if_not_exists(settings.TIMESHEETS_SHEET, TIMESHEET_COLUMNS)
            start = datetime.strptime(app.from_date, "%Y-%m-%d")
            end = datetime.strptime(app.to_date, "%Y-%m-%d")
            current = start

            while current <= end:
                if current.weekday() < 5:  # Mon-Fri only
                    hours = 4.0 if app.half_day else 8.0
                    task_desc = f"Leave - {app.leave_type_code}"
                    if app.half_day:
                        period_label = "First Half" if app.half_day_period == "first_half" else "Second Half"
                        task_desc += f" ({period_label})"

                    ts = TimesheetCreate(
                        work_date=current.strftime("%Y-%m-%d"),
                        associate_id=app.associate_id,
                        project_id="LEAVE",
                        task=task_desc,
                        hours=hours,
                        status="Approved",
                        comments=f"Auto-generated from leave {leave_id}"
                    )
                    sheets_service.append_row(settings.TIMESHEETS_SHEET, timesheet_to_row(ts))
                current += timedelta(days=1)
        except Exception as ts_err:
            logger.error(f"Error creating timesheet entries for leave: {ts_err}")

        # Send email notification to applicant
        try:
            assoc_record = sheets_service.get_row_by_id(
                settings.ASSOCIATES_SHEET, "Associate ID", app.associate_id.strip()
            )
            if assoc_record:
                assoc_email = str(assoc_record.get("Email", "")).strip()
                if assoc_email:
                    subject = f"Leave Approved: {app.from_date} to {app.to_date}"
                    body = f"""
<html>
<body style="font-family: 'Segoe UI', sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
<div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px 12px 0 0;">
    <h2 style="color: white; margin: 0;">✅ Leave Approved</h2>
</div>
<div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
    <p>Hi {app.associate_name},</p>
    <p>Your leave application has been <strong style="color: #10b981;">approved</strong> by {approver_name}.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: 600; color: #64748b;">Leave Type</td><td style="padding: 8px;">{app.leave_type_code}</td></tr>
        <tr style="background: #f1f5f9;"><td style="padding: 8px; font-weight: 600; color: #64748b;">From</td><td style="padding: 8px;">{app.from_date}</td></tr>
        <tr><td style="padding: 8px; font-weight: 600; color: #64748b;">To</td><td style="padding: 8px;">{app.to_date}</td></tr>
        <tr style="background: #f1f5f9;"><td style="padding: 8px; font-weight: 600; color: #64748b;">Total Days</td><td style="padding: 8px;">{app.total_days}</td></tr>
    </table>
    {f'<p><strong>Remarks:</strong> {action.remarks}</p>' if action.remarks else ''}
</div>
</body>
</html>
"""
                    await email_service.send_email(assoc_email, subject, body, html=True)
        except Exception as email_err:
            logger.error(f"Failed to send approval email: {email_err}")

        return {"success": True, "message": "Leave approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving leave: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /{leave_id}/reject  — reject leave ─────────────────────────
@router.post("/{leave_id}/reject", response_model=dict)
async def reject_leave(
    leave_id: str,
    action: LeaveActionRequest = LeaveActionRequest(),
    current_user: TokenData = Depends(get_current_user)
):
    """Reject a leave application."""
    try:
        row_idx = sheets_service.find_row_index(
            settings.LEAVE_APPLICATIONS_SHEET, "Leave ID", leave_id
        )
        if not row_idx:
            raise HTTPException(status_code=404, detail="Leave application not found")

        records = sheets_service.get_all_records(settings.LEAVE_APPLICATIONS_SHEET)
        record = records[row_idx - 2]
        app = row_to_leave_application(record, row_idx)

        if app.status != "Pending":
            raise HTTPException(status_code=400, detail=f"Leave is already {app.status}")

        approver_name = current_user.name or current_user.associate_id
        sheets_service.update_cell(settings.LEAVE_APPLICATIONS_SHEET, row_idx, 11, "Rejected")
        sheets_service.update_cell(settings.LEAVE_APPLICATIONS_SHEET, row_idx, 13, approver_name)
        if action.remarks:
            sheets_service.update_cell(settings.LEAVE_APPLICATIONS_SHEET, row_idx, 14, action.remarks)

        # Send email notification to applicant
        try:
            assoc_record = sheets_service.get_row_by_id(
                settings.ASSOCIATES_SHEET, "Associate ID", app.associate_id.strip()
            )
            if assoc_record:
                assoc_email = str(assoc_record.get("Email", "")).strip()
                if assoc_email:
                    subject = f"Leave Rejected: {app.from_date} to {app.to_date}"
                    body = f"""
<html>
<body style="font-family: 'Segoe UI', sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
<div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 24px; border-radius: 12px 12px 0 0;">
    <h2 style="color: white; margin: 0;">❌ Leave Rejected</h2>
</div>
<div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
    <p>Hi {app.associate_name},</p>
    <p>Your leave application has been <strong style="color: #ef4444;">rejected</strong> by {approver_name}.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: 600; color: #64748b;">Leave Type</td><td style="padding: 8px;">{app.leave_type_code}</td></tr>
        <tr style="background: #f1f5f9;"><td style="padding: 8px; font-weight: 600; color: #64748b;">From</td><td style="padding: 8px;">{app.from_date}</td></tr>
        <tr><td style="padding: 8px; font-weight: 600; color: #64748b;">To</td><td style="padding: 8px;">{app.to_date}</td></tr>
    </table>
    {f'<p><strong>Reason:</strong> {action.remarks}</p>' if action.remarks else ''}
    <p style="color: #64748b; font-size: 0.875rem;">Please contact your manager for details.</p>
</div>
</body>
</html>
"""
                    await email_service.send_email(assoc_email, subject, body, html=True)
        except Exception as email_err:
            logger.error(f"Failed to send rejection email: {email_err}")

        return {"success": True, "message": "Leave rejected"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting leave: {e}")
        raise HTTPException(status_code=500, detail=str(e))
