from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File, Form
import traceback
from typing import List, Optional
from services.google_sheets import sheets_service
from models.hrms.expense_report import (
    ExpenseReport, ExpenseReportCreate, ExpenseReportUpdate,
    ExpenseItem, ExpenseItemCreate,
    EXPENSE_COLUMNS, EXPENSE_REPORT_STATUS,
    generate_report_id, generate_expense_id,
    expense_item_to_row, row_to_expense_item, group_rows_to_report
)
from models.common.notification import NotificationCreate
from config import settings
from datetime import datetime
from middleware.auth_middleware import get_current_user, TokenData
from utils.logging_utils import trace_exceptions_async
from services.email_service import email_service
from models.hrms.associate import row_to_associate
from services.google_drive import drive_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ============== EXPENSE REPORTS ==============

@router.get("/reports", response_model=List[ExpenseReport])
@trace_exceptions_async
async def get_expense_reports(
    associate_id: Optional[str] = None,
    project_id: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all expense reports with optional filters."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        # Group by Expense Report ID
        report_ids = set()
        for r in records:
            report_id = r.get("Expense Report ID")
            if report_id:
                report_ids.add(report_id)
        
        reports = []
        for report_id in report_ids:
            report = group_rows_to_report(records, report_id)
            if report:
                # Apply filters
                if associate_id and report.associate_id != associate_id:
                    continue
                if project_id and report.project_id != project_id:
                    continue
                if status and report.status != status:
                    continue
                reports.append(report)
        
        # Sort by most recent first
        reports.sort(key=lambda x: x.expense_report_id, reverse=True)
        return reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/{report_id}", response_model=ExpenseReport)
async def get_expense_report(report_id: str):
    """Get a single expense report with all items."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        report = group_rows_to_report(records, report_id)
        
        if not report:
            raise HTTPException(status_code=404, detail="Expense report not found")
        
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports", response_model=dict)
async def create_expense_report(report: ExpenseReportCreate):
    """Create a new expense report with items."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        # Calculate next report sequence
        now = datetime.now()
        quarter = (now.month - 1) // 3 + 1
        # Prefix format matching generate_report_id logic: GTEXPQ{quarter}{year}{month:02d}
        prefix = f"GTEXPQ{quarter}{now.year}{now.month:02d}"
        
        max_seq = 0
        for r in records:
            rid = str(r.get("Expense Report ID", ""))
            if rid.startswith(prefix):
                try:
                    # ID format: prefix + 3 digit sequence
                    if len(rid) >= len(prefix) + 3:
                        seq_str = rid[len(prefix):len(prefix)+3]
                        seq = int(seq_str)
                        if seq > max_seq:
                            max_seq = seq
                except ValueError:
                    continue
        
        report_id = generate_report_id(max_seq + 1)
        rows_added = 0
        
        for idx, item in enumerate(report.items, 1):
            expense_id = generate_expense_id(report_id, idx)
            row = expense_item_to_row(
                expense_report_id=report_id,
                expense_id=expense_id,
                item=item,
                associate_id=report.associate_id,
                project_id=report.project_id,
                project_name=report.project_name or "",
                expense_report_name=report.expense_report_name or "",
                expense_report_date=report.expense_report_date or "",
                status="DRAFT"
            )
            sheets_service.append_row(settings.EXPENSES_SHEET, row)
            rows_added += 1
        
        return {
            "success": True,
            "expense_report_id": report_id,
            "items_added": rows_added
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/reports/{report_id}", response_model=dict)
async def update_expense_report(report_id: str, update: ExpenseReportUpdate):
    """Update an expense report. Replaces all items if provided."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        # Find existing rows for this report
        existing_rows = []
        for idx, r in enumerate(records):
            if r.get("Expense Report ID") == report_id:
                existing_rows.append(idx + 2)  # 1-indexed, +1 for header
        
        if not existing_rows:
            raise HTTPException(status_code=404, detail="Expense report not found")
        
        # Get current status and comments to preserve history
        current_status = records[existing_rows[0] - 2].get("Status", "DRAFT")
        existing_comments = records[existing_rows[0] - 2].get("Comments", "")
        
        # Only allow updates if DRAFT or REJECTED
        if current_status not in ["DRAFT", "REJECTED"]:
            raise HTTPException(status_code=400, detail="Cannot modify submitted or approved reports")
        
        # Delete existing rows (in reverse order to maintain indices)
        for row_index in sorted(existing_rows, reverse=True):
            sheets_service.delete_row(settings.EXPENSES_SHEET, row_index)
        
        # Add new items
        items = update.items or []
        associate_id = update.associate_id or records[existing_rows[0] - 2].get("Associate ID", "")
        project_id = update.project_id or records[existing_rows[0] - 2].get("Project ID", "")
        project_name = update.project_name or records[existing_rows[0] - 2].get("Project Name", "")
        expense_report_name = update.expense_report_name or records[existing_rows[0] - 2].get("Expense Report Name", "")
        expense_report_date = update.expense_report_date or records[existing_rows[0] - 2].get("Expense Report Date", "")
        
        rows_added = 0
        for idx, item in enumerate(items, 1):
            expense_id = generate_expense_id(report_id, idx)
            row = expense_item_to_row(
                expense_report_id=report_id,
                expense_id=expense_id,
                item=item,
                associate_id=associate_id,
                project_id=project_id,
                project_name=project_name,
                expense_report_name=expense_report_name,
                expense_report_date=expense_report_date,
                status="DRAFT",
                comments=existing_comments
            )
            sheets_service.append_row(settings.EXPENSES_SHEET, row)
            rows_added += 1
        
        return {
            "success": True,
            "expense_report_id": report_id,
            "items_updated": rows_added
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/reports/{report_id}", response_model=dict)
async def delete_expense_report(report_id: str):
    """Delete an expense report and all its items."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        # Find all rows for this report
        rows_to_delete = []
        for idx, r in enumerate(records):
            if r.get("Expense Report ID") == report_id:
                rows_to_delete.append(idx + 2)
        
        if not rows_to_delete:
            raise HTTPException(status_code=404, detail="Expense report not found")
        
        # Delete in reverse order
        for row_index in sorted(rows_to_delete, reverse=True):
            sheets_service.delete_row(settings.EXPENSES_SHEET, row_index)
        
        return {
            "success": True,
            "rows_deleted": len(rows_to_delete)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============== RECEIPT UPLOAD ==============

@router.post("/reports/upload-receipt", response_model=dict)
@trace_exceptions_async
async def upload_receipt(
    report_id: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload a receipt file to Google Drive and return the link."""
    try:
        parent_folder_id = settings.DRIVE_EXPENSES_FOLDER_ID
        if not parent_folder_id:
            raise HTTPException(status_code=500, detail="DRIVE_EXPENSES_FOLDER_ID not configured")

        # Create or find subfolder for this report
        # Search for existing folder first
        folder_id = None
        try:
            query = f"name='{report_id}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            results = drive_service._service.files().list(
                q=query, fields='files(id)', supportsAllDrives=True, includeItemsFromAllDrives=True
            ).execute()
            files = results.get('files', [])
            if files:
                folder_id = files[0]['id']
        except Exception as e:
            logger.warning(f"Error searching for folder: {e}")

        if not folder_id:
            folder_id = drive_service.create_folder(report_id, parent_folder_id)
            if not folder_id:
                raise HTTPException(status_code=500, detail="Failed to create folder in Google Drive")

        # Read file content
        file_bytes = await file.read()
        mime_type = file.content_type or 'application/octet-stream'
        filename = file.filename or 'receipt'

        # Upload file
        file_id = drive_service.upload_file_binary(file_bytes, filename, mime_type, folder_id)
        if not file_id:
            raise HTTPException(status_code=500, detail="Failed to upload file to Google Drive")

        # Make the file publicly readable
        drive_service.make_public_reader(file_id)

        return {
            "success": True,
            "file_id": file_id,
            "folder_id": folder_id,
            "filename": filename
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading receipt: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== APPROVAL WORKFLOW ==============

@router.post("/reports/{report_id}/submit", response_model=dict)
async def submit_expense_report(
    report_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Submit an expense report for approval. Notifies project manager."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        # Find rows for this report
        report_rows = []
        for idx, r in enumerate(records):
            if r.get("Expense Report ID") == report_id:
                report_rows.append((idx + 2, r))
        
        if not report_rows:
            raise HTTPException(status_code=404, detail="Expense report not found")
        
        current_status = report_rows[0][1].get("Status", "DRAFT")
        if current_status not in ["DRAFT", "REJECTED"]:
            raise HTTPException(status_code=400, detail="Report is already submitted or approved")
        
        # Append history to comments
        # Format: <dd-mmm-yyyy hh:MM:ss> <user> <Submitted> <comments>
        status_col = EXPENSE_COLUMNS.index("Status") + 1  # 1-indexed
        comments_col = EXPENSE_COLUMNS.index("Comments") + 1
        
        existing_comments = report_rows[0][1].get("Comments", "")
        timestamp = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
        user_name = current_user.name or current_user.associate_id
        
        new_comment_entry = f"{timestamp} {user_name} Submitted"
        
        # If there are existing comments, append with newline
        final_comments = existing_comments
        if final_comments:
             final_comments += f"\n{new_comment_entry}"
        else:
             final_comments = new_comment_entry

        # Update status to SUBMITTED and update comments for all rows
        for row_index, _ in report_rows:
            sheets_service.update_cell(settings.EXPENSES_SHEET, row_index, status_col, "SUBMITTED")
            sheets_service.update_cell(settings.EXPENSES_SHEET, row_index, comments_col, final_comments)
        
        # Get project info to find manager
        project_id = report_rows[0][1].get("Project ID", "")
        associate_id = report_rows[0][1].get("Associate ID", "")
        project_name = report_rows[0][1].get("Project Name", "")
        
        # Calculate total
        total = sum(float(r.get("Expense", 0) or 0) for _, r in report_rows)
        
        # Look up project manager
        manager_id = None
        if project_id:
            projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
            for p in projects:
                if p.get("Project ID") == project_id:
                    manager_id = p.get("Project Manager ID")
                    break
        
        # Create notification for manager
        if manager_id:
            notification = NotificationCreate(
                user_id=str(manager_id),
                type="ExpenseReportSubmitted",
                title="Expense Report Submitted",
                message=f"Expense report {report_id} for {project_name or project_id} (₹{total:,.0f}) submitted by {associate_id}",
                link=f"/expenses?report={report_id}",
                is_read=False
            )
            from routers.common.notifications import create_notification
            await create_notification(notification)
        
        return {
            "success": True,
            "status": "SUBMITTED",
            "manager_notified": manager_id or "No manager found"
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/{report_id}/approve", response_model=dict)
async def approve_expense_report(
    report_id: str, 
    reviewer_id: Optional[str] = None,
    comments: str = "",
    current_user: TokenData = Depends(get_current_user)
):
    """Approve an expense report with optional comments."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        report_rows = []
        for idx, r in enumerate(records):
            if r.get("Expense Report ID") == report_id:
                report_rows.append((idx + 2, r))
        
        if not report_rows:
            raise HTTPException(status_code=404, detail="Expense report not found")
        
        current_status = report_rows[0][1].get("Status", "DRAFT")
        if current_status != "SUBMITTED":
            raise HTTPException(status_code=400, detail="Only submitted reports can be approved")
        
        # Decide final status
        final_status = "APPROVED"
        total_self = sum(float(r[1].get("Expense", 0) or 0) for r in report_rows if r[1].get("Payment Mode") != "Corporate Card" and r[1].get("Payment Mode") != "Bank Transfer")
        total_bank = sum(float(r[1].get("Expense", 0) or 0) for r in report_rows if r[1].get("Payment Mode") == "Bank Transfer")
        
        # If it's ONLY bank transfer, it goes to PAID directly as requested
        # Logic: If it has bank transfer items AND no self-reimbursement items
        # Corporate card items don't block auto-PAID for bank transfer because they are also pre-paid/company-paid
        if total_bank > 0 and total_self == 0:
            final_status = "PAID"

        # Update status and comments
        status_col = EXPENSE_COLUMNS.index("Status") + 1
        comments_col = EXPENSE_COLUMNS.index("Comments") + 1
        existing_comments = report_rows[0][1].get("Comments", "") or ""
        timestamp = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
        user_name = current_user.name or current_user.associate_id

        comment_text = comments.strip() if comments else ""
        action_name = "Approved & Paid" if final_status == "PAID" else "Approved"
        new_comment_entry = f"{timestamp} {user_name} {action_name} {comment_text}".strip()
        
        final_comments = existing_comments
        if final_comments:
             final_comments += f"\n{new_comment_entry}"
        else:
             final_comments = new_comment_entry
        
        for row_index, _ in report_rows:
            sheets_service.update_cell(settings.EXPENSES_SHEET, row_index, status_col, final_status)
            sheets_service.update_cell(settings.EXPENSES_SHEET, row_index, comments_col, final_comments)
        
        # Notify associate
        associate_id = report_rows[0][1].get("Associate ID", "")
        if associate_id:
            msg_title = "Expense Report Approved" if final_status == "APPROVED" else "Expense Report Paid"
            msg_body = f"Your expense report {report_id} has been {final_status.lower()}. {f'Comments: {comments}' if comments else ''}"
            notification = NotificationCreate(
                user_id=str(associate_id),
                type=f"ExpenseReport{final_status.capitalize()}",
                title=msg_title,
                message=msg_body,
                link=f"/expenses?report={report_id}",
                is_read=False
            )
            from routers.common.notifications import create_notification
            await create_notification(notification)
        
        return {
            "success": True,
            "status": final_status
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error approving report {report_id}: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/{report_id}/reject", response_model=dict)
async def reject_expense_report(
    report_id: str, 
    reason: str = "",
    reviewer_id: Optional[str] = None,
    comments: str = "",
    current_user: TokenData = Depends(get_current_user)
):
    """Reject an expense report with reason."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        report_rows = []
        for idx, r in enumerate(records):
            if r.get("Expense Report ID") == report_id:
                report_rows.append((idx + 2, r))
        
        if not report_rows:
            raise HTTPException(status_code=404, detail="Expense report not found")
        
        current_status = report_rows[0][1].get("Status", "DRAFT")
        if current_status != "SUBMITTED":
            raise HTTPException(status_code=400, detail="Only submitted reports can be rejected")
        
        # Update status to REJECTED and update comments
        status_col = EXPENSE_COLUMNS.index("Status") + 1
        comments_col = EXPENSE_COLUMNS.index("Comments") + 1
        
        existing_comments = report_rows[0][1].get("Comments", "") or ""
        timestamp = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
        user_name = current_user.name or current_user.associate_id
        
        reject_msg = reason or comments or "No reason specified"
        new_comment_entry = f"{timestamp} {user_name} Rejected {reject_msg}"
        
        final_comments = existing_comments
        if final_comments:
             final_comments += f"\n{new_comment_entry}"
        else:
             final_comments = new_comment_entry
        
        for row_index, _ in report_rows:
            sheets_service.update_cell(settings.EXPENSES_SHEET, row_index, status_col, "REJECTED")
            sheets_service.update_cell(settings.EXPENSES_SHEET, row_index, comments_col, final_comments)
        
        # Notify associate
        associate_id = report_rows[0][1].get("Associate ID", "")
        if associate_id:
            notification = NotificationCreate(
                user_id=str(associate_id),
                type="ExpenseReportRejected",
                title="Expense Report Rejected",
                message=f"Your expense report {report_id} was rejected. Reason: {reason or 'Not specified'}",
                link=f"/expenses?report={report_id}",
                is_read=False
            )
            from routers.common.notifications import create_notification
            await create_notification(notification)
        
        # Email Notification for Rejections
        if associate_id:
            try:
                assoc_record = sheets_service.get_row_by_id(settings.ASSOCIATES_SHEET, "Associate ID", associate_id.strip())
                if assoc_record:
                    associate = row_to_associate(assoc_record)
                    await email_service.send_rejection_email(
                        type="Expense Report",
                        associate_email=associate.email,
                        associate_name=associate.associate_name,
                        identifier=report_id,
                        reason=reason
                    )
            except Exception as email_err:
                print(f"Failed to send expense rejection email to {associate_id}: {email_err}")
        
        return {
            "success": True,
            "status": "REJECTED",
            "reason": reason,
            "comments": comments
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error rejecting report {report_id}: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/{report_id}/withdraw", response_model=dict)
async def withdraw_expense_report(
    report_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Withdraw a submitted expense report, changing its status back to DRAFT."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        report_rows = []
        for idx, r in enumerate(records):
            if r.get("Expense Report ID") == report_id:
                report_rows.append((idx + 2, r))
        
        if not report_rows:
            raise HTTPException(status_code=404, detail="Expense report not found")
        
        current_status = report_rows[0][1].get("Status", "DRAFT")
        if current_status != "SUBMITTED":
            raise HTTPException(status_code=400, detail="Only submitted reports can be withdrawn")
            
        # Check if current user is the owner or admin/manager
        associate_id = report_rows[0][1].get("Associate ID", "")
        if current_user.role not in ['Admin', 'Manager'] and current_user.associate_id != str(associate_id):
             raise HTTPException(status_code=403, detail="You can only withdraw your own reports")
        
        status_col = EXPENSE_COLUMNS.index("Status") + 1
        comments_col = EXPENSE_COLUMNS.index("Comments") + 1
        
        existing_comments = report_rows[0][1].get("Comments", "") or ""
        timestamp = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
        user_name = current_user.name or current_user.associate_id
        
        new_comment_entry = f"{timestamp} {user_name} Withdrawn"
        
        final_comments = existing_comments
        if final_comments:
             final_comments += f"\n{new_comment_entry}"
        else:
             final_comments = new_comment_entry
             
        for row_index, _ in report_rows:
            sheets_service.update_cell(settings.EXPENSES_SHEET, row_index, status_col, "DRAFT")
            sheets_service.update_cell(settings.EXPENSES_SHEET, row_index, comments_col, final_comments)
            
        # Get project info to find manager
        project_id = report_rows[0][1].get("Project ID", "")
        project_name = report_rows[0][1].get("Project Name", "")
        
        # Look up project manager
        manager_id = None
        if project_id:
            projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
            for p in projects:
                if p.get("Project ID") == project_id:
                    manager_id = p.get("Project Manager ID")
                    break
                    
        # Notify manager
        if manager_id:
            notification = NotificationCreate(
                user_id=str(manager_id),
                type="ExpenseReportWithdrawn",
                title="Expense Report Withdrawn",
                message=f"Expense report {report_id} was withdrawn by {user_name}",
                link=f"/expenses?report={report_id}",
                is_read=False
            )
            from routers.common.notifications import create_notification
            await create_notification(notification)
            
        return {
            "success": True,
            "status": "DRAFT"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error withdrawing report {report_id}: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/{report_id}/pay", response_model=dict)
async def pay_expense_report(
    report_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Mark an approved expense report as PAID."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        report_rows = []
        for idx, r in enumerate(records):
            if r.get("Expense Report ID") == report_id:
                report_rows.append((idx + 2, r))
        
        if not report_rows:
            raise HTTPException(status_code=404, detail="Expense report not found")
        
        current_status = report_rows[0][1].get("Status", "DRAFT")
        if current_status != "APPROVED":
            raise HTTPException(status_code=400, detail="Only approved reports can be marked as paid")
        
        status_col = EXPENSE_COLUMNS.index("Status") + 1
        comments_col = EXPENSE_COLUMNS.index("Comments") + 1
        
        existing_comments = report_rows[0][1].get("Comments", "") or ""
        timestamp = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
        user_name = current_user.name or current_user.associate_id
        
        new_comment_entry = f"{timestamp} {user_name} Paid"
        
        final_comments = existing_comments
        if final_comments:
             final_comments += f"\n{new_comment_entry}"
        else:
             final_comments = new_comment_entry
             
        for row_index, _ in report_rows:
            sheets_service.update_cell(settings.EXPENSES_SHEET, row_index, status_col, "PAID")
            sheets_service.update_cell(settings.EXPENSES_SHEET, row_index, comments_col, final_comments)
            
        # Notify associate
        associate_id = report_rows[0][1].get("Associate ID", "")
        if associate_id:
            notification = NotificationCreate(
                user_id=str(associate_id),
                type="ExpenseReportPaid",
                title="Expense Report Paid",
                message=f"Your expense report {report_id} has been marked as paid.",
                link=f"/expenses?report={report_id}",
                is_read=False
            )
            from routers.common.notifications import create_notification
            await create_notification(notification)
            
        return {
            "success": True,
            "status": "PAID"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error marking report {report_id} as paid: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============== LEGACY ENDPOINTS (keep for backward compatibility) ==============

@router.get("/summary", response_model=dict)
async def get_expense_summary(
    project_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    financial_year: Optional[str] = None
):
    """Get expense summary with optional filters."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        total_expenses = 0
        category_totals = {}
        project_totals = {}
        monthly_project_totals = {}  # { "YYYY-MM": { "ProjectID": amount } }
        monthly_category_totals = {}  # { "YYYY-MM": { "Category": amount } }
        
        for r in records:
            if not r.get("Date"):
                continue
            
            # Parse date once
            date_str = r.get("Date", "")
            expense_date = None
            for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"]:
                try:
                    expense_date = datetime.strptime(date_str, fmt)
                    break
                except ValueError:
                    continue
            
            if not expense_date:
                continue

            # Apply project filter
            if project_id and r.get("Project ID") != project_id:
                continue
            
            # Apply date filters
            if year and expense_date.year != year:
                continue
            if month and expense_date.month != month:
                continue

            # Apply financial year filter
            if financial_year:
                # FY24-25 -> start_date = 2024-04-01, end_date = 2025-03-31
                try:
                    parts = financial_year.replace('FY', '').split('-')
                    if len(parts) == 2:
                        # Assume 20xx for FY
                        start_yr = int("20" + parts[0])
                        # Handle cases like FY24-25
                        if int(parts[1]) < 100:
                             end_yr = int("20" + parts[1])
                        else:
                             end_yr = int(parts[1])
                             
                        fy_start = datetime(start_yr, 4, 1)
                        fy_end = datetime(end_yr, 3, 31, 23, 59, 59)
                        if not (fy_start <= expense_date <= fy_end):
                            continue
                    elif len(parts) == 1 and parts[0].isdigit():
                        # Handle just year
                         pass
                except Exception:
                    continue
            
            amount = float(r.get("Expense", 0) or 0)
            total_expenses += amount
            
            # Aggregate by category
            cat = r.get("Category", "Other")
            if cat not in category_totals:
                category_totals[cat] = 0
            category_totals[cat] += amount
            
            # Aggregate by project
            proj = r.get("Project ID", "Unassigned")
            if proj not in project_totals:
                project_totals[proj] = 0
            project_totals[proj] += amount

            # Aggregate monthly
            month_key = expense_date.strftime("%Y-%m")
            
            # Project aggregation
            if month_key not in monthly_project_totals:
                monthly_project_totals[month_key] = {}
            if proj not in monthly_project_totals[month_key]:
                monthly_project_totals[month_key][proj] = 0
            monthly_project_totals[month_key][proj] += amount

            # Category aggregation
            if month_key not in monthly_category_totals:
                monthly_category_totals[month_key] = {}
            if cat not in monthly_category_totals[month_key]:
                monthly_category_totals[month_key][cat] = 0
            monthly_category_totals[month_key][cat] += amount
        
        # Sort monthly data
        sorted_monthly_project = {k: monthly_project_totals[k] for k in sorted(monthly_project_totals)}
        sorted_monthly_category = {k: monthly_category_totals[k] for k in sorted(monthly_category_totals)}
        
        return {
            "total_expenses": total_expenses,
            "by_category": category_totals,
            "by_project": project_totals,
            "monthly_by_project": sorted_monthly_project,
            "monthly_by_category": sorted_monthly_category
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/categories", response_model=List[str])
async def get_expense_categories():
    """Get list of unique expense categories."""
    try:
        records = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        categories = set()
        for r in records:
            if r.get("Category"):
                categories.add(r.get("Category"))
        return sorted(list(categories))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
