from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from services.google_sheets import sheets_service
from models.hrms.timesheet import (
    Timesheet, TimesheetCreate, TimesheetUpdate, TimesheetBulkStatusUpdate,
    timesheet_to_row, row_to_timesheet, TIMESHEET_COLUMNS
)
from config import settings
from datetime import datetime, timedelta
from fastapi import Depends
from middleware.auth_middleware import get_current_user, TokenData
from utils.logging_utils import trace_exceptions_async
from models.common.notification import NotificationCreate, notification_to_row
from models.hrms.project import row_to_project
from models.hrms.associate import row_to_associate
from services.email_service import email_service

router = APIRouter()

@router.get("/", response_model=List[Timesheet])
@trace_exceptions_async
async def get_timesheets(
    associate_id: Optional[str] = None,
    project_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get timesheets with optional filters."""
    try:
        # Create sheet if it doesn't exist
        sheets_service.create_sheet_if_not_exists(
            settings.TIMESHEETS_SHEET, TIMESHEET_COLUMNS
        )
        
        records = sheets_service.get_all_records(settings.TIMESHEETS_SHEET)
        timesheets = []
        
        for idx, r in enumerate(records):
            if not r.get("Associate ID"):
                continue
            
            # Apply filters
            if associate_id and r.get("Associate ID") != associate_id:
                continue
            if project_id and r.get("Project ID") != project_id:
                continue
            
            # Date range filter
            if start_date or end_date:
                date_str = r.get("Work Date", "")
                try:
                    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"]:
                        try:
                            entry_date = datetime.strptime(date_str, fmt)
                            break
                        except ValueError:
                            continue
                    else:
                        continue
                    
                    if start_date:
                        start = datetime.strptime(start_date, "%Y-%m-%d")
                        if entry_date < start:
                            continue
                    if end_date:
                        end = datetime.strptime(end_date, "%Y-%m-%d")
                        if entry_date > end:
                            continue
                except Exception:
                    continue
            
            timesheets.append(row_to_timesheet(r, idx + 2))
        
        return timesheets
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=dict)
async def create_timesheet(timesheet: TimesheetCreate):
    """Create a new timesheet entry."""
    try:
        # Create sheet if it doesn't exist
        sheets_service.create_sheet_if_not_exists(
            settings.TIMESHEETS_SHEET, TIMESHEET_COLUMNS
        )
        
        row = timesheet_to_row(timesheet)
        result = sheets_service.append_row(settings.TIMESHEETS_SHEET, row)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk", response_model=dict)
async def bulk_create_timesheets(timesheets: List[TimesheetCreate]):
    """Create multiple timesheet entries."""
    try:
        # Create sheet if it doesn't exist
        sheets_service.create_sheet_if_not_exists(
            settings.TIMESHEETS_SHEET, TIMESHEET_COLUMNS
        )
        
        count = 0
        project_ids = set()
        associate_id = timesheets[0].associate_id if timesheets else ""
        
        for ts in timesheets:
            row = timesheet_to_row(ts)
            sheets_service.append_row(settings.TIMESHEETS_SHEET, row)
            count += 1
            if ts.status == 'Submitted':
                project_ids.add(ts.project_id)
        
        # Trigger notifications for managers if submitted
        if project_ids:
            try:
                # Create notification sheet if it doesn't exist
                notif_sheet = settings.NOTIFICATIONS_SHEET if hasattr(settings, 'NOTIFICATIONS_SHEET') else "Notifications"
                sheets_service.create_sheet_if_not_exists(notif_sheet, ["Notification ID", "User ID", "Type", "Title", "Message", "Link", "Is Read", "Created At"])
                
                # Get associate name
                assoc_record = sheets_service.get_row_by_id(settings.ASSOCIATES_SHEET, "Associate ID", associate_id.strip())
                assoc_name = assoc_record.get("Associate Name", associate_id) if assoc_record else associate_id
                
                for pid in project_ids:
                    # Find project manager
                    proj_record = sheets_service.get_row_by_id(settings.PROJECTS_SHEET, "Project ID", pid.strip())
                    if proj_record:
                        pm_id = str(proj_record.get("Project Manager ID", "")).strip()
                        if pm_id:
                            # Create notification for manager
                            notif = NotificationCreate(
                                user_id=pm_id,
                                type='TimesheetSubmitted',
                                title='Timesheet Pending Approval',
                                message=f'{assoc_name} has submitted timesheets for project {pid}.',
                                link='/timesheets'
                            )
                            sheets_service.append_row(
                                notif_sheet,
                                notification_to_row(notif)
                            )
            except Exception as e:
                print(f"Failed to send notification: {e}")
        
        return {"success": True, "message": f"Added {count} timesheet entries"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{row_index}", response_model=dict)
async def update_timesheet(row_index: int, update: TimesheetUpdate):
    """Update a timesheet entry by row index."""
    try:
        records = sheets_service.get_all_records(settings.TIMESHEETS_SHEET)
        if row_index < 2 or row_index > len(records) + 1:
            raise HTTPException(status_code=404, detail="Timesheet entry not found")
        
        current_record = records[row_index - 2]
        current_ts = row_to_timesheet(current_record)
        
        update_data = update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(current_ts, key, value)
        
        merged = TimesheetCreate(**current_ts.model_dump(exclude={"row_index"}))
        row = timesheet_to_row(merged)
        
        result = sheets_service.update_row(settings.TIMESHEETS_SHEET, row_index, row)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk-status", response_model=dict)
async def bulk_update_status(
    update: TimesheetBulkStatusUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    """Update status for multiple timesheet entries."""
    try:
        # Status is in the 8th column, Comments in the 9th
        status_col_index = 8
        comments_col_index = 9
        
        # We need to notify the associate about the status change
        records = sheets_service.get_all_records(settings.TIMESHEETS_SHEET)
        processed_associates = {} # associate_id -> set of project_ids
        
        timestamp = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
        user_name = current_user.name or current_user.associate_id
        
        for row_index in update.row_indices:
            # Update Status
            sheets_service.update_cell(
                settings.TIMESHEETS_SHEET, 
                row_index, 
                status_col_index, 
                update.status
            )
            
            # Format and Append Comments
            if row_index - 2 < len(records):
                r = records[row_index - 2]
                existing_comments = r.get("Comments", "") or ""
                
                # Format: <dd-mmm-yyyy hh:MM:ss> <user> <status> <comment or status change>
                action_msg = update.reason if update.status == 'Rejected' else update.status
                new_comment_entry = f"{timestamp} {user_name} {update.status} {action_msg}" if update.reason else f"{timestamp} {user_name} {update.status}"
                
                final_comments = existing_comments
                if final_comments:
                    final_comments += f"\n{new_comment_entry}"
                else:
                    final_comments = new_comment_entry

                sheets_service.update_cell(
                    settings.TIMESHEETS_SHEET,
                    row_index,
                    comments_col_index,
                    final_comments
                )
            
            # Track for notification
            if row_index - 2 < len(records):
                r = records[row_index - 2]
                aid = r.get("Associate ID")
                pid = r.get("Project ID")
                if aid:
                    if aid not in processed_associates:
                        processed_associates[aid] = set()
                    processed_associates[aid].add(pid)
        
        # Trigger notifications for associates
        for aid, pids in processed_associates.items():
            try:
                type_map = {
                    'Approved': 'TimesheetApproved',
                    'Rejected': 'TimesheetRejected',
                    'Saved': 'TimesheetReturned'
                }
                notif_type = type_map.get(update.status, 'TimesheetUpdated')
                
                message = f'Your timesheets for projects {", ".join(pids)} have been {update.status.lower()}.'
                if update.status == 'Rejected' and update.reason:
                    message += f' Reason: {update.reason}'
                
                # Internal Notification
                notif = NotificationCreate(
                    user_id=aid,
                    type=notif_type,
                    title=f'Timesheet {update.status}',
                    message=message,
                    link='/timesheets'
                )
                sheets_service.append_row(
                    settings.NOTIFICATIONS_SHEET if hasattr(settings, 'NOTIFICATIONS_SHEET') else "Notifications",
                    notification_to_row(notif)
                )

                # Email Notification for Rejections
                if update.status == 'Rejected':
                    try:
                        assoc_record = sheets_service.get_row_by_id(settings.ASSOCIATES_SHEET, "Associate ID", aid.strip())
                        if assoc_record:
                            associate = row_to_associate(assoc_record)
                            await email_service.send_rejection_email(
                                type="Timesheet",
                                associate_email=associate.email,
                                associate_name=associate.associate_name,
                                identifier=f"Projects: {', '.join(pids)}",
                                reason=update.reason
                            )
                    except Exception as email_err:
                        print(f"Failed to send rejection email to {aid}: {email_err}")

            except Exception as e:
                print(f"Failed to notify associate {aid}: {e}")
        
        return {"success": True, "message": f"Updated {len(update.row_indices)} entries to {update.status}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/team", response_model=List[Timesheet])
@trace_exceptions_async
async def get_team_timesheets(
    statuses: Optional[List[str]] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    """Get all timesheets pending approval for projects managed by the current user."""
    try:
        # 1. Get managed projects
        all_proj_records = sheets_service.get_all_records(settings.PROJECTS_SHEET)
        managed_project_ids = set()
        is_admin = current_user.role.lower() == "admin"
        curr_associate_id = str(current_user.associate_id).strip()
        
        for r in all_proj_records:
            pm_id = str(r.get("Project Manager ID", "")).strip()
            if is_admin or pm_id == curr_associate_id:
                pid = str(r.get("Project ID", "")).strip()
                if pid:
                    managed_project_ids.add(pid)
        
        if not managed_project_ids:
            return []
            
        # 2. Get all timesheets and filter
        records = sheets_service.get_all_records(settings.TIMESHEETS_SHEET)
        timesheets = []
        
        # Default statuses to show if none provided
        target_statuses = [s.strip().lower() for s in statuses] if statuses else ["submitted", "approved"]
        
        for idx, r in enumerate(records):
            pid = str(r.get("Project ID", "")).strip()
            if pid in managed_project_ids:
                status = str(r.get("Status", "")).strip().lower()
                if status in target_statuses:
                    ts = row_to_timesheet(r, idx + 2)
                    timesheets.append(ts)
                
        return timesheets
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{row_index}", response_model=dict)
async def delete_timesheet(row_index: int):
    """Delete a timesheet entry by row index."""
    try:
        result = sheets_service.delete_row(settings.TIMESHEETS_SHEET, row_index)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/weekly-summary", response_model=dict)
async def get_weekly_summary(
    associate_id: str = Query(..., description="Associate ID"),
    week_start: str = Query(..., description="Week start date (YYYY-MM-DD)")
):
    """Get weekly timesheet summary for an associate."""
    try:
        records = sheets_service.get_all_records(settings.TIMESHEETS_SHEET)
        
        start_date = datetime.strptime(week_start, "%Y-%m-%d")
        end_date = start_date + timedelta(days=6)
        
        daily_hours = {i: 0 for i in range(7)}
        project_hours = {}
        total_billable = 0
        total_non_billable = 0
        
        for r in records:
            if r.get("Associate ID") != associate_id:
                continue
            
            date_str = r.get("Work Date", "")
            try:
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"]:
                    try:
                        entry_date = datetime.strptime(date_str, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    continue
                
                if entry_date < start_date or entry_date > end_date:
                    continue
                
                hours = float(r.get("Hours", 0) or 0)
                day_index = (entry_date - start_date).days
                daily_hours[day_index] += hours
                
                project_id = r.get("Project ID", "Unknown")
                if project_id not in project_hours:
                    project_hours[project_id] = 0
                project_hours[project_id] += hours
            except Exception:
                continue
        
        return {
            "associate_id": associate_id,
            "week_start": week_start,
            "daily_hours": daily_hours,
            "project_hours": project_hours,
            "total_hours": sum(daily_hours.values()),
            "billable_hours": sum(daily_hours.values()), # Logic changed: billable tracking removed from sheet
            "non_billable_hours": 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/project/{project_id}/hours", response_model=dict)
async def get_project_hours(project_id: str):
    """Get total hours logged for a project."""
    try:
        records = sheets_service.get_all_records(settings.TIMESHEETS_SHEET)
        
        total_hours = 0
        billable_hours = 0
        associate_hours = {}
        
        for r in records:
            if r.get("Project ID") != project_id:
                continue
            
            hours = float(r.get("Hours", 0) or 0)
            total_hours += hours
            
            associate_id = r.get("Associate ID", "Unknown")
            if associate_id not in associate_hours:
                associate_hours[associate_id] = 0
            associate_hours[associate_id] += hours
        
        return {
            "project_id": project_id,
            "total_hours": total_hours,
            "by_associate": associate_hours
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
