import logging
import traceback
from datetime import datetime
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Any
from services.google_sheets import sheets_service
from models.common.currency import row_to_currency_rate, get_month_name
from config import settings
from utils.logging_utils import trace_exceptions_async

logger = logging.getLogger("chrms.dashboard")

router = APIRouter()

def safe_parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Helper to safely parse dates from sheets in various formats."""
    if not date_str or not str(date_str).strip():
        return None
    
    date_str = str(date_str).strip()
    # Common formats in Google Sheets
    formats = [
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", 
        "%Y/%m/%d", "%d-%b-%Y", "%b %y", "%d %b %Y"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None

def safe_float(value: Any) -> float:
    """Safely convert value to float, handling commas and currency symbols."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    
    # Handle string
    s_val = str(value).strip()
    if not s_val:
        return 0.0
        
    try:
        # Remove commas and currency symbols if present
        s_val = s_val.replace(",", "").replace("₹", "").replace("$", "").replace("%", "")
        return float(s_val)
    except (ValueError, TypeError):
        return 0.0

@router.get("/pending-approvals")
@trace_exceptions_async
async def get_pending_approvals(manager_id: Optional[str] = None):
    # Trigger reload
    """Get count of pending timesheets and expense reports for a manager."""
    # Get all required data
    projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
    timesheets = sheets_service.get_all_records(settings.TIMESHEETS_SHEET)
    expenses = sheets_service.get_all_records(settings.EXPENSES_SHEET)

    # 1. Identify Managed Projects
    managed_project_ids = set()
    if manager_id:
        # Filter projects where user is the manager
        for p in projects:
            pm_id = str(p.get("Project Manager ID", "")).strip()
            if pm_id == str(manager_id).strip():
                pid = str(p.get("Project ID", "")).strip()
                if pid:
                    managed_project_ids.add(pid)
    else:
        # If no manager_id (e.g. Admin view all), include all active projects? 
        # Or perhaps specific logic. For now, let's assume if no manager_id, we count ALL pending.
        # But the requirement is "for the logged in manager".
        # If Admin calls without manager_id, they might expect system-wide pending.
        # Let's populate all project IDs if manager_id is None.
        managed_project_ids = {str(p.get("Project ID", "")).strip() for p in projects if p.get("Project ID")}

    # 2. Count Pending Timesheets
    pending_timesheets = 0
    for t in timesheets:
         status = str(t.get("Status", "")).strip()
         pid = str(t.get("Project ID", "")).strip()
         if status == 'Submitted' and pid in managed_project_ids:
             pending_timesheets += 1

    # 3. Count Pending Expense Reports
    # Expenses are stored as items, so we need to group by Report ID first
    pending_reports = set()
    for e in expenses:
        status = str(e.get("Status", "")).strip()
        pid = str(e.get("Project ID", "")).strip()
        # Check status and project match
        # Note: Expenses line items have status, but usually report status is what matters. 
        # The sheet structure implies 'Status' column exists.
        if status == 'Submitted' and pid in managed_project_ids:
            report_id = str(e.get("Expense Report ID", "")).strip()
            if report_id:
                pending_reports.add(report_id)
    
    pending_expenses = len(pending_reports)

    return {
        "timesheets": pending_timesheets,
        "expenses": pending_expenses,
        "total": pending_timesheets + pending_expenses
    }

@router.get("/overview")
@trace_exceptions_async
async def get_dashboard_overview(manager_id: Optional[str] = None):
    """Get high-level dashboard metrics."""
    try:
        # Get counts
        associates = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
        projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
        allocations = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        
        # Filter strictly for ACTIVE associates
        active_associates_list = []
        status_counts = defaultdict(int)
        
        for a in associates:
            status = str(a.get("Status", "")).strip()
            if status.lower() == "active" and a.get("Associate ID"):
                 active_associates_list.append(a)

        total_active_associates_count = len(active_associates_list)
        active_associate_ids = {str(a.get("Associate ID", "")).strip() for a in active_associates_list}

        # Filter projects by manager if provided
        managed_projects = projects
        if manager_id:
            managed_projects = [p for p in projects if str(p.get("Project Manager ID", "")).strip() == str(manager_id).strip()]
        
        managed_project_ids = {str(p.get("Project ID", "")).strip() for p in managed_projects if p.get("Project ID")}
        
        active_projects_list = [p for p in managed_projects if str(p.get("Status", "")).lower() in ["active", "in progress"]]
        active_projects = len(active_projects_list)
        
        active_revenue_projects = len([
            p for p in active_projects_list 
            if str(p.get("Type", p.get("Project Type", ""))).lower() == "revenue"
        ])
        
        active_investment_projects = len([
            p for p in active_projects_list 
            if str(p.get("Type", p.get("Project Type", ""))).lower() == "investment"
        ])
        
        # --- Associate Breakdown Logic ---
        # 1. Map Projects to Types and Status
        project_types = {}
        project_active_status = {}
        for p in projects:
            pid = str(p.get("Project ID", "")).strip()
            if pid:
                project_types[pid] = str(p.get("Type", p.get("Project Type", ""))).lower()
                status = str(p.get("Status", "")).lower()
                project_active_status[pid] = status in ["active", "in progress"]

        # 2. Group Allocations by Associate
        # Only consider allocations for ACTIVE associates
        associate_allocations = defaultdict(list)
        for alloc in allocations:
            aid = str(alloc.get("Associate ID", "")).strip()
            pid = str(alloc.get("Project ID", "")).strip()
            
            if aid in active_associate_ids and pid:
                associate_allocations[aid].append(pid)

        # 3. Categorize Associates
        revenue_associates_set = set()
        internal_associates_set = set()
        
        target_associates = active_associates_list
        
        if manager_id:
            # For Manager View: Filter by "Manager" column in Associates sheet
            # This captures all Active reportees, including those on Bench (unallocated)
            target_associates = [
                a for a in active_associates_list
                if str(a.get("Manager", "")).strip() == str(manager_id).strip()
            ]
            
            # Also include the manager themselves if they are active? 
            # Usually "My Team" means reportees. 
            # If the dashboard is "My View", maybe it should include self?
            # Let's stick to reportees + self if self is in active_associates
            # But "Manager" column usually points to *their* manager.
            # So `a.get("Manager") == manager_id` finds reportees.
            # To include self: `a.get("Associate ID") == manager_id`.
            # Let's include self for completeness of "My Allocations" context?
            # Actually, "My Team" usually means people I manage.
            # Let's stick to reportees.
            # Wait, verify if the user sees themselves in "Total Associates"?
            # usage: label={user?.role === 'Manager' ? "My Team" : "Total Associates"}
            # "My Team" implies reportees.
            pass
            
            # Update total count to reflect "My Team" active count
            total_active_associates_count = len(target_associates)

        # Iterate through target associates and categorize
        for assoc in target_associates:
            aid = str(assoc.get("Associate ID", "")).strip()
            pids = associate_allocations.get(aid, [])
            
            # Check for ANY active allocation
            has_revenue = False
            has_internal = False
            
            for pid in pids:
                # Only consider ACTIVE allocations (Project is Active)
                if project_active_status.get(pid, False):
                    p_type = project_types.get(pid, "")
                    if p_type == "revenue":
                        has_revenue = True
                    elif p_type in ["internal", "investment"]:
                        has_internal = True
            
            if has_revenue:
                revenue_associates_set.add(aid)
            elif has_internal:
                internal_associates_set.add(aid)
            # Else: Bench (handled by subtraction)

        revenue_count = len(revenue_associates_set)
        internal_count = len(internal_associates_set)
        bench_count = total_active_associates_count - (revenue_count + internal_count)
        
        # Calculate utilization
        total_active_allocations = 0
        for aid, pids in associate_allocations.items():
            # Sum up total allocation percentage for each associate
            # We need to filter allocations that are actually active
            # For simplicity in overview, let's use the utilization logic
            pass
        
        # Calculate Average Utilization % across active associates
        # (Total Allocation % / Total Active Associates)
        avg_utilization = 0
        if total_active_associates_count > 0:
            total_pct = 0
            for assoc in target_associates:
                aid = str(assoc.get("Associate ID", "")).strip()
                pids = associate_allocations.get(aid, [])
                assoc_total = 0
                for pid in pids:
                    if project_active_status.get(pid, False):
                        # Find the actual allocation % for this pid/aid combo
                        # This is a bit expensive, but let's do it for the count
                        for alloc in allocations:
                            if str(alloc.get("Associate ID", "")).strip() == aid and str(alloc.get("Project ID", "")).strip() == pid:
                                assoc_total += safe_float(alloc.get("Allocation %", 100))
                total_pct += min(assoc_total, 100) # Cap at 100% for utilization metric
            avg_utilization = round(total_pct / total_active_associates_count, 1)

        return {
            "total_associates": total_active_associates_count,
            "revenue_associates": revenue_count,
            "internal_associates": internal_count,
            "bench_associates": bench_count,
            "active_projects": active_projects,
            "active_revenue_projects": active_revenue_projects,
            "active_investment_projects": active_investment_projects,
            "total_projects": len(managed_projects),
            "average_utilization": avg_utilization
        }
    except Exception as e:
        logger.error(f"Error in dashboard/overview: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/allocation-by-month")
async def get_allocation_by_month(
    year: int = Query(..., description="Year"),
    month: int = Query(..., description="Month (1-12)")
):
    """Get associate-wise allocation for a specific month."""
    try:
        allocations = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        associates = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
        projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
        
        # Build associate lookup
        associate_lookup = {
            str(a.get("Associate ID", "")).strip(): a.get("Associate Name", "")
            for a in associates if a.get("Associate ID")
        }
        
        # Build project lookup
        project_lookup = {
            str(p.get("Project ID", "")).strip(): p.get("Project Name", "")
            for p in projects if p.get("Project ID")
        }
        
        # Calculate target month range
        target_start = datetime(year, month, 1)
        if month == 12:
            target_end = datetime(year + 1, 1, 1)
        else:
            target_end = datetime(year, month + 1, 1)
        
        allocation_data = defaultdict(lambda: {
            "associate_name": "",
            "allocations": [],
            "total_allocation": 0,
            "billable_allocation": 0,
            "non_billable_allocation": 0
        })
        
        for r in allocations:
            associate_id = str(r.get("Associate ID", "")).strip()
            if not associate_id:
                continue
            
            product_id = str(r.get("Project ID", "")).strip()
            
            start_str = r.get("Start Date", "")
            end_str = r.get("End Date", "")
            
            alloc_start = safe_parse_date(start_str)
            alloc_end = safe_parse_date(end_str)
            
            if not alloc_end:
                alloc_end = datetime(2099, 12, 31)
            
            if not alloc_start:
                continue
            
            # Check if allocation overlaps with target month
            if alloc_start < target_end and alloc_end >= target_start:
                try:
                    alloc_pct = safe_float(r.get("Allocation %", 100))
                    alloc_type = str(r.get("Allocation Type", "")).lower()
                    
                    allocation_data[associate_id]["associate_name"] = associate_lookup.get(associate_id, f"Unknown ({associate_id})")
                    allocation_data[associate_id]["allocations"].append({
                        "project_id": product_id,
                        "project_name": project_lookup.get(product_id, f"Unknown ({product_id})"),
                        "allocation_type": r.get("Allocation Type"),
                        "allocation_percentage": alloc_pct
                    })
                    allocation_data[associate_id]["total_allocation"] += alloc_pct
                    
                    if alloc_type == "billable":
                        allocation_data[associate_id]["billable_allocation"] += alloc_pct
                    else:
                        allocation_data[associate_id]["non_billable_allocation"] += alloc_pct
                except Exception as row_err:
                    logger.warning(f"Error processing allocation row for {associate_id}: {row_err}")
                    continue
        
        result = []
        for associate_id, data in allocation_data.items():
            result.append({
                "associate_id": associate_id,
                **data
            })
        
        # Sort by associate name
        result.sort(key=lambda x: x["associate_name"])
        
        return {
            "year": year,
            "month": month,
            "allocations": result,
            "summary": {
                "total_associates_allocated": len(result),
                "average_allocation": round(
                    sum(a["total_allocation"] for a in result) / len(result), 2
                ) if result else 0
            }
        }
    except Exception as e:
        logger.error(f"Error in dashboard/allocation-by-month: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/project-profitability")
async def get_project_profitability(
    project_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    year: Optional[int] = None,
    manager_id: Optional[str] = None
):
    """
    Get project-wise revenue, expenditure, and profit analysis.
    
    Revenue = Invoice totals (converted to USD)
    Expenditure = Associate salary (prorated by allocation %) + Project expenses
    Profit = Revenue - Expenditure
    Profit % = (Profit / Revenue) * 100
    """
    try:
        projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
        try:
            invoices = sheets_service.get_all_records(settings.INVOICES_SHEET)
        except Exception:
            invoices = []
            
        allocations = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        associates = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
        expenses = sheets_service.get_all_records(settings.EXPENSES_SHEET)
        
        # Try to get currency rates
        try:
            currency_rates = sheets_service.get_all_records(settings.CURRENCY_SHEET)
        except:
            currency_rates = []
        
        # Build associate salary lookup (monthly salary = annual CTC / 12)
        associate_salaries = {}
        for a in associates:
            aid = a.get("Associate ID")
            if aid:
                annual_ctc = safe_float(a.get("Fixed CTC", 0))
                associate_salaries[aid] = annual_ctc / 12
        
        # Build currency rate lookup by year-month key
        # New format has Year and Month columns, rates are in a rates dict
        currency_lookup = {}
        currencies_available = []
        for cr in currency_rates:
            year_val = cr.get("Year")
            month_val = cr.get("Month")
            if year_val and month_val:
                # Determine available currencies from the record keys
                if not currencies_available:
                    currencies_available = [k for k in cr.keys() if k not in ["Year", "Month"]]
                # Store the rates dict keyed by "Year-Month" 
                key = f"{year_val}-{month_val}"
                currency_lookup[key] = cr
        
        # Helper function to convert amount to USD
        def convert_to_usd_helper(amount, currency, rate_record):
            currency = currency.upper()
            if currency == "USD":
                return amount
            rate = safe_float(rate_record.get(currency, 0))
            if rate == 0:
                return amount  # No conversion possible
            return amount / rate
        
        # Parse date filters
        filter_start = None
        filter_end = None
        
        if start_date:
            filter_start = datetime.strptime(start_date, "%Y-%m-%d")
        if end_date:
            filter_end = datetime.strptime(end_date, "%Y-%m-%d")
        if year and not filter_start:
            filter_start = datetime(year, 1, 1)
            filter_end = datetime(year, 12, 31)
        
        # Calculate metrics per project
        project_metrics = {}
        
        for p in projects:
            pid = p.get("Project ID")
            if not pid:
                continue
            if project_id and pid != project_id:
                continue
            if manager_id and str(p.get("Project Manager ID", "")).strip() != str(manager_id).strip():
                continue
            
            project_metrics[pid] = {
                "project_id": pid,
                "project_name": p.get("Project Name", ""),
                "client_name": p.get("Client Name", ""),
                "project_type": p.get("Type", p.get("Project Type", "")),
                "sow_value_usd": safe_float(p.get("SOW Value", p.get("SOW Value (USD)", 0))),
                "revenue": 0,
                "salary_cost": 0,
                "expense_cost": 0,
                "total_expenditure": 0,
                "profit": 0,
                "profit_percent": 0,
                "invoice_count": 0
            }
        
        # Calculate revenue from invoices
        for inv in invoices:
            pid = inv.get("Project ID")
            if not pid or pid not in project_metrics:
                continue
            
            # Date filtering for invoices
            inv_date_str = inv.get("InvoiceDate", "")
            if filter_start or filter_end:
                inv_date = safe_parse_date(inv_date_str)
                if not inv_date:
                    continue
                
                if filter_start and inv_date < filter_start:
                    continue
                if filter_end and inv_date > filter_end:
                    continue
            
            amount = safe_float(inv.get("InvoiceTotal", 0))
            currency = inv.get("Currency", "USD")
            
            # Convert to USD if needed
            if currency != "USD" and currency_lookup:
                # Try to get rate for invoice month
                inv_date = safe_parse_date(inv_date_str)
                if inv_date:
                    # Create key in "Year-Month" format (e.g., "2026-January")
                    month_key = f"{inv_date.year}-{get_month_name(inv_date.month)}"
                    if month_key in currency_lookup:
                        amount = convert_to_usd_helper(amount, currency, currency_lookup[month_key])
            
            project_metrics[pid]["revenue"] += amount
            project_metrics[pid]["invoice_count"] += 1
        
        # Calculate salary cost from allocations
        for alloc in allocations:
            pid = alloc.get("Project ID")
            aid = alloc.get("Associate ID")
            
            if not pid or pid not in project_metrics or not aid:
                continue
            
            alloc_pct = safe_float(alloc.get("Allocation %", 100)) / 100
            monthly_salary = associate_salaries.get(aid, 0)
            
            # Calculate duration of allocation
            start_str = alloc.get("Start Date", "")
            end_str = alloc.get("End Date", "")
            
            alloc_start = safe_parse_date(start_str)
            alloc_end = safe_parse_date(end_str)
            
            if not alloc_start:
                continue
            if not alloc_end:
                alloc_end = datetime.now()
            
            # Apply date filters
            if filter_start and alloc_end < filter_start:
                continue
            if filter_end and alloc_start > filter_end:
                continue
            
            # Adjust dates to filter range
            effective_start = max(alloc_start, filter_start) if filter_start else alloc_start
            effective_end = min(alloc_end, filter_end) if filter_end else alloc_end
            
            # Calculate months
            months = (effective_end.year - effective_start.year) * 12 + (effective_end.month - effective_start.month) + 1
            months = max(1, months)
            
            salary_cost = monthly_salary * alloc_pct * months
            project_metrics[pid]["salary_cost"] += salary_cost
        
        # Calculate expense cost
        for exp in expenses:
            pid = exp.get("Project ID")
            if not pid or pid not in project_metrics:
                continue
            
            # Date filtering
            if str(exp.get("Status", "")).upper() != "PAID":
                continue
                
            exp_date_str = exp.get("Date", "")
            if filter_start or filter_end:
                exp_date = safe_parse_date(exp_date_str)
                if not exp_date:
                    continue
                
                if filter_start and exp_date < filter_start:
                    continue
                if filter_end and exp_date > filter_end:
                    continue
            
            amount = safe_float(exp.get("Expense", 0))
            project_metrics[pid]["expense_cost"] += amount
        
        # Calculate totals and profit
        for pid, metrics in project_metrics.items():
            metrics["total_expenditure"] = metrics["salary_cost"] + metrics["expense_cost"]
            metrics["profit"] = metrics["revenue"] - metrics["total_expenditure"]
            if metrics["revenue"] > 0:
                metrics["profit_percent"] = round((metrics["profit"] / metrics["revenue"]) * 100, 2)
            else:
                metrics["profit_percent"] = 0
            
            # Round values
            metrics["revenue"] = round(metrics["revenue"], 2)
            metrics["salary_cost"] = round(metrics["salary_cost"], 2)
            metrics["expense_cost"] = round(metrics["expense_cost"], 2)
            metrics["total_expenditure"] = round(metrics["total_expenditure"], 2)
            metrics["profit"] = round(metrics["profit"], 2)
        
        result = list(project_metrics.values())
        result.sort(key=lambda x: x["profit"], reverse=True)
        
        # Calculate summary
        total_revenue = sum(m["revenue"] for m in result)
        total_expenditure = sum(m["total_expenditure"] for m in result)
        total_profit = sum(m["profit"] for m in result)
        
        return {
            "projects": result,
            "summary": {
                "total_projects": len(result),
                "total_revenue": round(total_revenue, 2),
                "total_expenditure": round(total_expenditure, 2),
                "total_profit": round(total_profit, 2),
                "overall_profit_percent": round((total_profit / total_revenue) * 100, 2) if total_revenue > 0 else 0
            },
            "filters": {
                "project_id": project_id,
                "start_date": start_date,
                "end_date": end_date,
                "year": year
            }
        }
    except Exception as e:
        logger.error(f"Error in dashboard/project-profitability: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/revenue-trend")
async def get_revenue_trend(
    year: int = Query(..., description="Year"),
    project_id: Optional[str] = None,
    manager_id: Optional[str] = None
):
    """Get monthly revenue trend for a year."""
    try:
        try:
            invoices = sheets_service.get_all_records(settings.INVOICES_SHEET)
        except Exception:
            # If Invoice sheet is not found, return empty trend
            return {
                "year": year,
                "project_id": project_id,
                "trend": [{ "month": m, "month_number": i+1, "revenue": 0, "invoice_count": 0 } for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])],
                "total_revenue": 0
            }
        
        # Filter projects by manager if provided to get project list
        filter_project_ids = None
        if manager_id and not project_id:
            projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
            filter_project_ids = {
                p.get("Project ID") 
                for p in projects 
                if str(p.get("Project Manager ID", "")).strip() == str(manager_id).strip()
            }
        
        # Initialize monthly data
        monthly_revenue = {m: 0 for m in range(1, 13)}
        monthly_count = {m: 0 for m in range(1, 13)}
        
        for inv in invoices:
            inv_pid = inv.get("Project ID")
            if project_id and inv_pid != project_id:
                continue
            if filter_project_ids is not None and inv_pid not in filter_project_ids:
                continue
            
            inv_date_str = inv.get("InvoiceDate", "")
            inv_date = safe_parse_date(inv_date_str)
            if not inv_date:
                continue
            
            if inv_date.year != year:
                continue
            
            amount = safe_float(inv.get("InvoiceTotal", 0))
            monthly_revenue[inv_date.month] += amount
            monthly_count[inv_date.month] += 1
        
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        trend_data = [
            {
                "month": months[m - 1],
                "month_number": m,
                "revenue": round(monthly_revenue[m], 2),
                "invoice_count": monthly_count[m]
            }
            for m in range(1, 13)
        ]
        
        return {
            "year": year,
            "project_id": project_id,
            "trend": trend_data,
            "total_revenue": round(sum(monthly_revenue.values()), 2)
        }
    except Exception as e:
        logger.error(f"Error in dashboard/revenue-trend: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/department-summary")
async def get_department_summary():
    """Get summary of associates by department."""
    try:
        associates = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
        
        dept_data = defaultdict(lambda: {
            "count": 0,
            "total_salary": 0,
            "average_experience": 0,
            "experiences": []
        })
        
        for a in associates:
            if not a.get("Associate ID"):
                continue
            
            dept = a.get("Department", "Unknown")
            dept_data[dept]["count"] += 1
            dept_data[dept]["total_salary"] += safe_float(a.get("Fixed CTC", 0))
            dept_data[dept]["experiences"].append(safe_float(a.get("Total Experience (Months)", 0)))
        
        result = []
        for dept, data in dept_data.items():
            avg_exp = sum(data["experiences"]) / len(data["experiences"]) if data["experiences"] else 0
            result.append({
                "department": dept,
                "associate_count": data["count"],
                "total_salary": round(data["total_salary"], 2),
                "average_salary": round(data["total_salary"] / data["count"], 2) if data["count"] > 0 else 0,
                "average_experience_months": round(avg_exp, 1)
            })
        
        result.sort(key=lambda x: x["associate_count"], reverse=True)
        
        return {
            "departments": result,
            "total_associates": sum(d["associate_count"] for d in result),
            "total_salary_expense": round(sum(d["total_salary"] for d in result), 2)
        }
    except Exception as e:
        logger.error(f"Error in dashboard/department-summary: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/utilization")
async def get_utilization_report(
    year: int = Query(..., description="Year"),
    month: int = Query(..., description="Month (1-12)"),
    manager_id: Optional[str] = None
):
    """Get resource utilization report for a month."""
    try:
        associates = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
        allocations = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        
        # Filter projects by manager to get associate subset if manager_id provided
        managed_associate_ids = None
        if manager_id:
            projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
            managed_project_ids = {
                p.get("Project ID") 
                for p in projects 
                if str(p.get("Project Manager ID", "")).strip() == str(manager_id).strip()
            }
            managed_associate_ids = {
                a.get("Associate ID") 
                for a in allocations 
                if a.get("Project ID") in managed_project_ids and a.get("Associate ID")
            }
        
        # Calculate target month range
        target_start = datetime(year, month, 1)
        if month == 12:
            target_end = datetime(year + 1, 1, 1)
        else:
            target_end = datetime(year, month + 1, 1)
        
        # Build associate list
        associate_util = {
            a.get("Associate ID"): {
                "associate_id": a.get("Associate ID"),
                "associate_name": a.get("Associate Name", ""),
                "department": a.get("Department", ""),
                "billable_allocation": 0,
                "non_billable_allocation": 0,
                "total_allocation": 0
            }
            for a in associates 
            if a.get("Associate ID") and (managed_associate_ids is None or a.get("Associate ID") in managed_associate_ids)
        }
        
        # Calculate allocations
        for alloc in allocations:
            aid = str(alloc.get("Associate ID", "")).strip()
            if not aid or aid not in associate_util:
                continue
            
            start_str = alloc.get("Start Date", "")
            end_str = alloc.get("End Date", "")
            
            alloc_start = safe_parse_date(start_str)
            alloc_end = safe_parse_date(end_str)
            
            if not alloc_end:
                alloc_end = datetime(2099, 12, 31)
            
            if not alloc_start:
                continue
            
            # Check overlap
            if alloc_start < target_end and alloc_end >= target_start:
                try:
                    alloc_pct = safe_float(alloc.get("Allocation %", 100))
                    alloc_type = str(alloc.get("Allocation Type", "")).lower()
                    
                    associate_util[aid]["total_allocation"] += alloc_pct
                    if alloc_type == "billable":
                        associate_util[aid]["billable_allocation"] += alloc_pct
                    else:
                        associate_util[aid]["non_billable_allocation"] += alloc_pct
                except Exception as row_err:
                    logger.warning(f"Error processing utilization for associate {aid}: {row_err}")
                    continue
        
        result = list(associate_util.values())
        
        # Categorize
        fully_utilized = [a for a in result if a["total_allocation"] >= 100]
        partially_utilized = [a for a in result if 0 < a["total_allocation"] < 100]
        unallocated = [a for a in result if a["total_allocation"] == 0]
        
        return {
            "year": year,
            "month": month,
            "summary": {
                "total_associates": len(result),
                "fully_utilized": len(fully_utilized),
                "partially_utilized": len(partially_utilized),
                "unallocated": len(unallocated),
                "average_utilization": round(
                    sum(a["total_allocation"] for a in result) / len(result), 2
                ) if result else 0,
                "billable_percentage": round(
                    sum(a["billable_allocation"] for a in result) / 
                    max(sum(a["total_allocation"] for a in result), 1) * 100, 2
                )
            },
            "fully_utilized": sorted(fully_utilized, key=lambda x: x["associate_name"]),
            "partially_utilized": sorted(partially_utilized, key=lambda x: x["total_allocation"], reverse=True),
            "unallocated": sorted(unallocated, key=lambda x: x["associate_name"])
        }
    except Exception as e:
        logger.error(f"Error in dashboard/utilization: {e}")
        logger.error(traceback.format_exc())
@router.get("/associate-overview")
async def get_associate_overview(associate_id: str):
    """Get personal dashboard metrics for an associate."""
    try:
        # Fetch data in parallel
        allocations = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
        timesheets = sheets_service.get_all_records(settings.TIMESHEETS_SHEET)
        projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
        
        # Current date for month calculations
        now = datetime.now()
        target_year = now.year
        target_month = now.month
        
        target_start = datetime(target_year, target_month, 1)
        if target_month == 12:
            target_end = datetime(target_year + 1, 1, 1)
        else:
            target_end = datetime(target_year, target_month + 1, 1)
            
        # Metrics to calculate
        metrics = {
            "total_allocation": 0,
            "billable_allocation": 0,
            "non_billable_allocation": 0,
            "active_project_count": 0,
            "pending_timesheet_count": 0,
            "allocation_trend": []
        }
        
        # 1. Allocation & Active Projects
        assigned_project_ids = set()
        for r in allocations:
            if str(r.get("Associate ID", "")).strip() == str(associate_id).strip():
                start_str = r.get("Start Date", "")
                end_str = r.get("End Date", "")
                
                alloc_start = safe_parse_date(start_str)
                alloc_end = safe_parse_date(end_str)
                if not alloc_end:
                    alloc_end = datetime(2099, 12, 31)
                
                if alloc_start and alloc_start < target_end and alloc_end >= target_start:
                    try:
                        pct = safe_float(r.get("Allocation %", 0))
                        m_type = str(r.get("Allocation Type", "")).lower()
                        
                        metrics["total_allocation"] += pct
                        if m_type == "billable":
                            metrics["billable_allocation"] += pct
                        else:
                            metrics["non_billable_allocation"] += pct
                            
                        assigned_project_ids.add(str(r.get("Project ID", "")).strip())
                    except:
                        pass

        # Verify active projects count from project master
        active_projects = 0
        for p in projects:
            pid = str(p.get("Project ID", "")).strip()
            if pid in assigned_project_ids and p.get("Status", "").lower() in ["active", "in progress"]:
                active_projects += 1
        metrics["active_project_count"] = active_projects
        
        # 2. Pending Timesheets
        pending_count = 0
        for ts in timesheets:
            if str(ts.get("Associate ID", "")).strip() == str(associate_id).strip():
                status = str(ts.get("Status", "")).lower()
                if status in ["draft", "rejected"]:
                    pending_count += 1
        metrics["pending_timesheet_count"] = pending_count
        
        # 3. Allocation Trend (Last 6 Months)
        trend = []
        for i in range(5, -1, -1):
            # Calculate month/year for i months ago
            m = target_month - i
            y = target_year
            if m <= 0:
                m += 12
                y -= 1
            
            t_start = datetime(y, m, 1)
            if m == 12:
                t_end = datetime(y + 1, 1, 1)
            else:
                t_end = datetime(y, m + 1, 1)
                
            m_total = 0
            m_billable = 0
            m_non_billable = 0
            for r in allocations:
                if str(r.get("Associate ID", "")).strip() == str(associate_id).strip():
                    a_start = safe_parse_date(r.get("Start Date", ""))
                    a_end = safe_parse_date(r.get("End Date", ""))
                    if not a_end: a_end = datetime(2099, 12, 31)
                    
                    if a_start and a_start < t_end and a_end >= t_start:
                        try:
                            pct = safe_float(r.get("Allocation %", 0))
                            alloc_type = str(r.get("Allocation Type", "")).lower()
                            m_total += pct
                            if alloc_type == "billable":
                                m_billable += pct
                            else:
                                m_non_billable += pct
                        except:
                            pass
            
            months_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            trend.append({
                "month": f"{months_names[m-1]} {str(y)[2:]}",
                "allocation": m_total,
                "billable": m_billable,
                "non_billable": m_non_billable
            })
        metrics["allocation_trend"] = trend
        
        return metrics
    except Exception as e:
        logger.error(f"Error in associate-overview: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
