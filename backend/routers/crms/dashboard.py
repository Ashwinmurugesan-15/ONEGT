from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
import re

from services.google_sheets import sheets_service
from config import settings
from utils.logging_utils import trace_exceptions_async

from middleware.auth_middleware import get_current_user_optional
from auth import TokenData
from models.crms.deal import DealFinanceView
from models.crms.invoice import Invoice, InvoiceItem
from routers.crms.invoices import parse_json_field, CRMS_INVOICES_SHEET

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crms/dashboard", tags=["CRMS - Dashboard"])


import re

def safe_float(val, default=0.0):
    try:
        if val is None or val == "":
            return default
        # If it's already a number, return it
        if isinstance(val, (int, float)):
            return float(val)
        # Try converting string by stripping non-numeric characters (except . and -)
        cleaned = re.sub(r'[^\d.-]', '', str(val))
        return float(cleaned) if cleaned else default
    except (ValueError, TypeError):
        return default


def safe_int(val, default=0):
    try:
        if val is None or val == "":
            return default
        if isinstance(val, (int, float)):
            return int(val)
        cleaned = re.sub(r'[^\d.-]', '', str(val))
        return int(float(cleaned)) if cleaned else default
    except (ValueError, TypeError):
        return default

def get_usd_converter():
    try:
        currency_records = sheets_service.get_all_records(settings.CURRENCY_SHEET)
        rates_map = {}
        for r in currency_records:
            year = safe_int(r.get("Year"))
            month = str(r.get("Month", ""))
            if year and month:
                rates_map[(year, month)] = {k: safe_float(v) for k, v in r.items() if k not in ["Year", "Month"]}
                
        def convert(value, record_currency, target_currency="USD", date_str=None):
            if not record_currency or record_currency.upper() == target_currency.upper() or value == 0:
                return value
            
            try:
                dt = None
                if date_str:
                    try:
                        dt = datetime.strptime(str(date_str)[:10], "%Y-%m-%d")
                    except ValueError:
                        pass
                
                months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                month_name = months[dt.month] if dt else None
                
                # Find rate to convert record currency to USD
                rate_to_usd = 1.0
                if record_currency.upper() != "USD":
                    available_rates = []
                    for (y, m), rates in rates_map.items():
                        if rates.get(record_currency.upper()):
                            month_idx = months.index(m) if m in months else 0
                            available_rates.append((y, month_idx, rates[record_currency.upper()]))
                            
                    if not available_rates:
                        return value # Cannot convert
                        
                    available_rates.sort(key=lambda x: (x[0], x[1]), reverse=True)
                    rate_to_usd = available_rates[0][2] # Default to latest
                    
                    if dt and month_name:
                        period_rates = rates_map.get((dt.year, month_name))
                        if period_rates and period_rates.get(record_currency.upper()):
                            rate_to_usd = period_rates[record_currency.upper()]
                
                # Convert to USD first
                usd_value = value / rate_to_usd
                
                # If target is USD, we're done
                if target_currency.upper() == "USD":
                    return usd_value
                    
                # Otherwise, find the target currency rate for the same period and multiply
                target_rate = None
                if dt and month_name:
                    period_rates = rates_map.get((dt.year, month_name))
                    if period_rates and period_rates.get(target_currency.upper()):
                        target_rate = period_rates[target_currency.upper()]
                
                if not target_rate:
                    # Find latest target rate
                    target_available_rates = []
                    for (y, m), rates in rates_map.items():
                        if rates.get(target_currency.upper()):
                            month_idx = months.index(m) if m in months else 0
                            target_available_rates.append((y, month_idx, rates[target_currency.upper()]))
                    if target_available_rates:
                        target_available_rates.sort(key=lambda x: (x[0], x[1]), reverse=True)
                        target_rate = target_available_rates[0][2]
                
                if target_rate:
                    return usd_value * target_rate
                    
                return usd_value
            except Exception as e:
                logger.error(f"Error converting currency: {e}")
                return value
                
        return convert
    except Exception as e:
        logger.error(f"Failed to initialize currency converter: {e}")
        return lambda v, rc, tc, d=None: v

def get_date_range(year_filter: str):
    """Parse year filter into (start_date, end_date)."""
    if not year_filter or year_filter == "All":
        return None, None
    
    try:
        if year_filter.startswith("FY"):
            # FY24-25
            parts = year_filter[2:].split('-')
            start_yy = int(parts[0])
            start_year = 2000 + start_yy
            end_year = start_year + 1
            return datetime(start_year, 4, 1), datetime(end_year, 3, 31, 23, 59, 59)
        else:
            # 2024
            yr = int(year_filter)
            return datetime(yr, 1, 1), datetime(yr, 12, 31, 23, 59, 59)
    except:
        return None, None


@router.get("/overview")
@trace_exceptions_async
async def get_crms_overview(
    year: str = None, 
    currency: str = "USD",
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Get CRMS dashboard overview statistics."""
    
    def matches_year(record, date_keys):
        if not year or year == "All":
            return True
        for key in date_keys:
            val = record.get(key, "")
            if val and val.startswith(year):
                return True
        return False

    def is_owned_by_user(record):
        if not current_user or current_user.role not in ["Marketing Manager", "Operations Manager"]:
            return True
        owner = str(record.get("Owner", "") or record.get("owner", "")).strip().lower()
        assigned_to = str(record.get("Assigned To", "") or record.get("Sales Person", "")).strip().lower()
        
        user_email = current_user.email.lower()
        user_name = current_user.name.lower()
        user_id = str(current_user.associate_id).strip().lower()
        
        return owner == user_email or owner == user_name or owner == user_id or assigned_to == user_email or assigned_to == user_name or assigned_to == user_id

    # Get leads stats
    all_leads = sheets_service.get_crms_all_records(settings.CRMS_LEADS_SHEET)
    leads = [l for l in all_leads if matches_year(l, ["Created At", "Created On"]) and is_owned_by_user(l)]
    leads_new = len([l for l in leads if l.get("Status") == "New"])
    leads_qualified = len([l for l in leads if l.get("Status") == "Qualified"])
    
    convert_currency = get_usd_converter()
    
    # Get opportunities stats
    all_opportunities = sheets_service.get_crms_all_records(settings.CRMS_OPPORTUNITIES_SHEET)
    opportunities = [o for o in all_opportunities 
                     if matches_year(o, ["Created At", "Created On", "Expected Close Date"]) and is_owned_by_user(o)]
    
    total_opp_value = sum(convert_currency(safe_float(o.get("Value")), o.get("Currency", "USD"), currency, o.get("Expected Close Date")) for o in opportunities)
    weighted_value = sum(
        convert_currency(safe_float(o.get("Value")), o.get("Currency", "USD"), currency, o.get("Expected Close Date")) * (safe_int(o.get("Probability")) / 100)
        for o in opportunities
    )
    
    # Get customers stats
    all_customers = sheets_service.get_crms_all_records(settings.CRMS_CUSTOMERS_SHEET)
    customers = [c for c in all_customers 
                 if matches_year(c, ["Created At", "Created On"])]
    
    # Get deals stats
    all_deals = sheets_service.get_crms_all_records(settings.CRMS_DEALS_SHEET)
    owned_deals = [d for d in all_deals if is_owned_by_user(d)]
    
    won_deals_total = []
    total_won_value = 0.0
    total_lost_value = 0.0
    lost_deals_count = 0
    total_deals_in_period = 0
    
    for d in owned_deals:
        stage = d.get("Stage")
        value = convert_currency(safe_float(d.get("Value")), d.get("Currency", "USD"), currency, d.get("Close Date", ""))
        
        if stage in ["Closed Won", "Closed Lost"]:
            if matches_year(d, ["Close Date"]):
                total_deals_in_period += 1
                if stage == "Closed Won":
                    total_won_value += value
                    won_deals_total.append(d)
                else:
                    total_lost_value += value
                    lost_deals_count += 1
        else:
            if matches_year(d, ["Created At", "Created On"]):
                total_deals_in_period += 1
    
    # Opportunity Cost = Lost deals
    opportunity_cost = total_lost_value
    
    # Lead Conversion Rate
    conversion_rate = (len(customers) / len(leads) * 100) if len(leads) > 0 else 0
    
    # Get tasks stats
    all_tasks = sheets_service.get_crms_all_records(settings.CRMS_TASKS_SHEET)
    tasks = [t for t in all_tasks if is_owned_by_user(t)]
    open_tasks = len([t for t in tasks if t.get("Status") == "Open"])
    overdue_tasks = len([
        t for t in tasks 
        if t.get("Status") == "Open" and t.get("Due Date")
        and t.get("Due Date") < datetime.now().strftime("%Y-%m-%d")
    ])
    
    return {
        "leads": {
            "total": len(leads),
            "new": leads_new,
            "qualified": leads_qualified
        },
        "opportunities": {
            "total": len(opportunities),
            "total_value": total_opp_value,
            "weighted_value": weighted_value
        },
        "customers": {
            "total": len(customers)
        },
        "deals": {
            "total": total_deals_in_period,
            "won": len(won_deals_total),
            "won_value": total_won_value,
            "lost": lost_deals_count,
            "lost_value": total_lost_value
        },
        "metrics": {
            "opportunity_cost": opportunity_cost,
            "conversion_rate": conversion_rate,
            "weighted_pipeline": weighted_value
        },
        "tasks": {
            "total": len(tasks),
            "open": open_tasks,
            "overdue": overdue_tasks
        }
    }


@router.get("/pipeline")
async def get_sales_pipeline(
    year: str = None, 
    currency: str = "USD",
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Get sales pipeline data."""
    def matches_year(record, date_keys):
        if not year or year == "All":
            return True
        for key in date_keys:
            val = record.get(key, "")
            if val and val.startswith(year):
                return True
        return False
        
    def is_owned_by_user(record):
        if not current_user or current_user.role not in ["Marketing Manager", "Operations Manager"]:
            return True
        owner = str(record.get("Owner", "") or record.get("owner", "")).strip().lower()
        assigned_to = str(record.get("Assigned To", "") or record.get("Sales Person", "")).strip().lower()
        
        user_email = current_user.email.lower()
        user_name = current_user.name.lower()
        user_id = str(current_user.associate_id).strip().lower()
        
        return owner == user_email or owner == user_name or owner == user_id or assigned_to == user_email or assigned_to == user_name or assigned_to == user_id
        
    all_opportunities = sheets_service.get_crms_all_records(settings.CRMS_OPPORTUNITIES_SHEET)
    opportunities = [o for o in all_opportunities if matches_year(o, ["Created At", "Created On", "Expected Close Date"]) and is_owned_by_user(o)]
    
    convert_currency = get_usd_converter()
    
    stages = ["Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]
    pipeline = {}
    
    for stage in stages:
        stage_opps = [o for o in opportunities if o.get("Stage") == stage]
        pipeline[stage] = {
            "count": len(stage_opps),
            "value": sum(convert_currency(safe_float(o.get("Value")), o.get("Currency", "USD"), currency, o.get("Expected Close Date")) for o in stage_opps)
        }
    
    return {
        "pipeline": pipeline,
        "total_opportunities": len(opportunities),
        "total_value": sum(convert_currency(safe_float(o.get("Value")), o.get("Currency", "USD"), currency, o.get("Expected Close Date")) for o in opportunities)
    }

@router.get("/lead-sources")
async def get_lead_sources(
    year: str = None,
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Get leads grouped by source."""
    def matches_year(record, date_keys):
        if not year or year == "All":
            return True
        for key in date_keys:
            val = record.get(key, "")
            if val and val.startswith(year):
                return True
        return False
        
    def is_owned_by_user(record):
        if not current_user or current_user.role not in ["Marketing Manager", "Operations Manager"]:
            return True
        owner = str(record.get("Owner", "") or record.get("owner", "")).strip().lower()
        assigned_to = str(record.get("Assigned To", "") or record.get("Sales Person", "")).strip().lower()
        
        user_email = current_user.email.lower()
        user_name = current_user.name.lower()
        user_id = str(current_user.associate_id).strip().lower()
        
        return owner == user_email or owner == user_name or owner == user_id or assigned_to == user_email or assigned_to == user_name or assigned_to == user_id
        
    all_leads = sheets_service.get_crms_all_records(settings.CRMS_LEADS_SHEET)
    leads = [l for l in all_leads if matches_year(l, ["Created At", "Created On"]) and is_owned_by_user(l)]
    
    sources = {}
    for lead in leads:
        source = lead.get("Source", "Unknown") or "Unknown"
        if source not in sources:
            sources[source] = 0
        sources[source] += 1
    
    return {
        "sources": sources,
        "total_leads": len(leads)
    }


@router.get("/recent-activities")
async def get_recent_activities(current_user: Optional[TokenData] = Depends(get_current_user_optional)):
    """Get recent CRM activities."""
    def is_owned_by_user(record):
        if not current_user or current_user.role not in ["Marketing Manager", "Operations Manager"]:
            return True
        owner = str(record.get("Owner", "") or record.get("owner", "") or record.get("Created By", "")).strip().lower()
        assigned_to = str(record.get("Assigned To", "") or record.get("Sales Person", "")).strip().lower()
        
        user_email = current_user.email.lower()
        user_name = current_user.name.lower()
        user_id = str(current_user.associate_id).strip().lower()
        
        return owner == user_email or owner == user_name or owner == user_id or assigned_to == user_email or assigned_to == user_name or assigned_to == user_id

    # Get recent calls
    all_calls = sheets_service.get_crms_all_records(settings.CRMS_CALLS_SHEET)
    calls = [c for c in all_calls if is_owned_by_user(c)]
    recent_calls = sorted(
        calls,
        key=lambda x: x.get("Created At", ""),
        reverse=True
    )[:10]
    
    # Get recent tasks
    all_tasks = sheets_service.get_crms_all_records(settings.CRMS_TASKS_SHEET)
    tasks = [t for t in all_tasks if is_owned_by_user(t)]
    recent_tasks = sorted(
        tasks,
        key=lambda x: x.get("Created At", ""),
        reverse=True
    )[:10]
    
    return {
        "recent_calls": [
            {
                "id": c.get("Call ID"),
                "contact_id": c.get("Contact ID"),
                "direction": c.get("Direction"),
                "outcome": c.get("Outcome"),
                "call_date": c.get("Call Date")
            }
            for c in recent_calls
        ],
        "recent_tasks": [
            {
                "id": t.get("Task ID"),
                "title": t.get("Title"),
                "status": t.get("Status"),
                "priority": t.get("Priority"),
                "due_date": t.get("Due Date")
            }
            for t in recent_tasks
        ]
    }


@router.get("/finance")
@trace_exceptions_async
async def get_finance_overview(current_user: Optional[TokenData] = Depends(get_current_user_optional)):
    """Get finance overview data with timeline info for matching deals and invoices."""
    
    def is_owned_by_user(record):
        if not current_user or current_user.role not in ["Marketing Manager", "Operations Manager"]:
            return True
        owner = str(record.get("Owner", "") or record.get("owner", "") or record.get("Created By", "")).strip().lower()
        assigned_to = str(record.get("Assigned To", "") or record.get("Sales Person", "")).strip().lower()
        
        user_email = current_user.email.lower()
        user_name = current_user.name.lower()
        user_id = str(current_user.associate_id).strip().lower()
        
        return owner == user_email or owner == user_name or owner == user_id or assigned_to == user_email or assigned_to == user_name or assigned_to == user_id

    # 1. Fetch Deals
    all_deals = sheets_service.get_crms_all_records(settings.CRMS_DEALS_SHEET)
    owned_deals = [d for d in all_deals if is_owned_by_user(d)]

    # 2. Fetch Invoices
    all_invoices = sheets_service.get_crms_all_records(CRMS_INVOICES_SHEET)
    
    # 3. Process Invoices into Models
    invoice_models = []
    for inv in all_invoices:
        try:
            items_raw = inv.get("Items", "[]")
            items_list = parse_json_field(items_raw, [])
            items = [InvoiceItem(**item) for item in items_list]
            
            invoice_models.append(Invoice(
                id=str(inv.get("Invoice Id", "")),
                deal_id=inv.get("Deal Id", "") or None,
                customer_id=inv.get("Customer Id", "") or "",
                invoice_number=inv.get("Invoice Number", "") or "",
                issue_date=inv.get("Issue Date", "") or "",
                due_date=inv.get("Due Date", "") or "",
                status=inv.get("Status", "Draft"),
                template_id=inv.get("Template Id") or None,
                items=items,
                notes=inv.get("Notes", "") or None,
                currency=inv.get("Currency", "USD"),
                tax_rate=safe_float(inv.get("Tax Rate"), 0),
                discount=safe_float(inv.get("Discount"), 0),
                total_amount=safe_float(inv.get("Invoice Total", inv.get("Total Amount")), 0),
                created_at=inv.get("Created At", "") or None,
                updated_at=inv.get("Updated At", "") or None,
                payment_date=inv.get("Payment Date", "") or None,
                credit_currency=inv.get("Payment Currency", inv.get("Credit Currency", "")) or None,
                credited_amount=safe_float(inv.get("Paid Amount", inv.get("Credited Amount")), None)
            ))
        except Exception as e:
            logger.warning(f"Error parsing invoice {inv.get('Invoice Id')}: {e}")

    # 4. Group invoices by deal_id
    invoices_by_deal: Dict[str, List[Invoice]] = {}
    for inv in invoice_models:
        if inv.deal_id:
            if inv.deal_id not in invoices_by_deal:
                invoices_by_deal[inv.deal_id] = []
            invoices_by_deal[inv.deal_id].append(inv)
            
    # 5. Build DealFinanceView list
    finance_deals = []
    for d in owned_deals:
        deal_id = str(d.get("Deal ID", ""))
        finance_deal = DealFinanceView(
            id=deal_id,
            customer_id=d.get("Customer ID") or None,
            name=d.get("Deal Name", ""),
            value=safe_float(d.get("Value"), 0.0),
            currency=d.get("Currency", "USD"),
            stage=d.get("Stage", "Prospecting"),
            close_date=d.get("Close Date") or None,
            start_date=d.get("Start Date") or None,
            end_date=d.get("End Date") or None,
            owner_id=d.get("Owner") or None,
            notes=d.get("Notes") or None,
            sow_number=d.get("SOW Number") or None,
            sow=d.get("SOW Link") or None,
            po_number=d.get("PO Number") or None,
            created_at=d.get("Created At") or None,
            updated_at=d.get("Updated At") or None,
            invoices=invoices_by_deal.get(deal_id, [])
        )
        finance_deals.append(finance_deal)
        
    return {"deals": finance_deals}

@router.get("/finance/debug-payroll")
async def debug_payroll():
    # Call the actual profitability function internally to see what it generates
    res = await get_finance_profitability()
    
    all_projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
    project_to_deal_map = {
        str(p.get("Project ID", "")).strip(): str(p.get("Deal ID", "")).strip()
        for p in all_projects 
        if str(p.get("Project ID", "")).strip() and str(p.get("Deal ID", "")).strip()
    }
    
    return {
        "project_to_deal_map": project_to_deal_map,
        "all_projects": all_projects,
        "profitability": res
    }

@router.get("/finance/profitability")
@trace_exceptions_async
async def get_finance_profitability(
    currency: str = "USD",
    year: str = "All",
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Get profitability data mapped by Project (Deal)."""
    
    start_date, end_date = get_date_range(year)
    
    # 1. Fetch Deals
    all_deals = sheets_service.get_crms_all_records(settings.CRMS_DEALS_SHEET)
    
    # Currency converter
    convert_currency = get_usd_converter()
    
    # 2. Fetch Customers
    all_customers = sheets_service.get_crms_all_records(settings.CRMS_CUSTOMERS_SHEET)
    customer_map = {str(c.get("Customer ID", "")).strip(): c.get("Customer Name", "") for c in all_customers}
    
    # 3. Fetch Invoices -> Income
    all_invoices = sheets_service.get_crms_all_records(CRMS_INVOICES_SHEET)
    
    # 4. Fetch Payroll -> Exact Salary values per associate & month
    all_payroll = sheets_service.get_all_records(settings.PAYROLL_SHEET)
    payroll_map = {} # dict[(associate_id, year, month)] -> earnings
    for row in all_payroll:
        aid = str(row.get("Employee Code") or row.get("Associate ID") or "").strip()
        year = str(row.get("Year") or row.get("Payroll Year") or "").strip()
        month = str(row.get("Month") or row.get("Payroll Month") or "").strip()
        earnings_str = str(row.get("Earnings", "0")).replace(",", "").replace("₹", "").strip()
        # Fallback to Net Pay if Earnings not available
        if not safe_float(earnings_str, 0):
            earnings_str = str(row.get("Net Pay", "0")).replace(",", "").replace("₹", "").strip()
        
        earnings = safe_float(earnings_str, 0.0)
        
        if aid and year and month:
            # Standardize month to 3 letter abbreviation or full name parsing if needed
            payroll_map[(aid, year, month[:3].capitalize())] = earnings
            # Also store with full month name just in case
            payroll_map[(aid, year, month.capitalize())] = earnings

    # 5. Fetch Projects to map Project ID to Deal ID
    all_projects = sheets_service.get_all_records(settings.PROJECTS_SHEET)
    
    # Pre-process deals for matching by Customer ID and Value
    deals_by_cust_val = {}
    for d in all_deals:
        c_id = str(d.get("Customer ID", "")).strip()
        val_str = str(d.get("Value", "")).replace(",", "").replace("$", "").replace("₹", "").strip()
        if c_id and val_str:
            val = safe_float(val_str)
            if val > 0:
                key = f"{c_id}_{val}"
                deals_by_cust_val[key] = str(d.get("Deal ID", "")).strip()

    project_to_deal_map = {}
    for p in all_projects:
        pid = str(p.get("Project ID", "")).strip()
        if not pid: continue
        
        did = str(p.get("Deal ID", "")).strip()
        if did:
            project_to_deal_map[pid] = did
        else:
            # Fallback to Customer ID and SOW Value match
            c_id = str(p.get("Customer ID", "")).strip()
            sow_val = str(p.get("SOW Value", "0")).replace(",", "").replace("$", "").replace("₹", "").strip()
            if c_id and sow_val:
                val = safe_float(sow_val)
                if val > 0:
                    key = f"{c_id}_{val}"
                    if key in deals_by_cust_val:
                        project_to_deal_map[pid] = deals_by_cust_val[key]

    # 5b. Fetch Allocations -> Salary Expenses
    all_allocations = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
    
    def calculate_allocation_cost(alloc, aid, alloc_start, alloc_end):
        try:
            alloc_pct = safe_float(str(alloc.get("Allocation %", "")).replace("%", ""), 100) / 100
            
            # Create a date range to check exactly which months are covered
            current_date = alloc_start
            
            # Use filter start/end to restrict calculation
            filter_start = start_date or datetime(2020, 1, 1)
            filter_end = end_date or datetime(2099, 12, 31)
            
            total_cost = 0.0
            
            while current_date <= alloc_end:
                if current_date > filter_end:
                    break
                
                # Check if this month overlaps with the filter range
                if current_date.month == 12:
                    next_month = datetime(current_date.year + 1, 1, 1)
                else:
                    next_month = datetime(current_date.year, current_date.month + 1, 1)
                
                month_end = next_month - timedelta(days=1)
                
                if month_end < filter_start:
                    current_date = next_month
                    continue
                year_str = str(current_date.year)
                month_str_short = current_date.strftime("%b") # e.g., 'Jan'
                month_str_long = current_date.strftime("%B") # e.g., 'January'
                
                # Check payroll map
                monthly_salary = payroll_map.get((aid, year_str, month_str_long)) or \
                                 payroll_map.get((aid, year_str, month_str_short))
                                 
                if monthly_salary is None:
                    # Explicitly fallback to 0.0 if exact payroll for that month is missing
                    monthly_salary = 0.0
                
                # Calculate how many days in this month are within the allocation
                # Next month start
                if current_date.month == 12:
                    next_month = datetime(current_date.year + 1, 1, 1)
                else:
                    next_month = datetime(current_date.year, current_date.month + 1, 1)
                
                month_end = next_month - timedelta(days=1)
                
                # Overlap of allocation period and this month
                overlap_end = min(alloc_end, month_end)
                overlap_start = max(alloc_start, datetime(current_date.year, current_date.month, 1))
                
                overlap_days = (overlap_end - overlap_start).days + 1
                days_in_month = (month_end - datetime(current_date.year, current_date.month, 1)).days + 1
                
                cost_for_month = (monthly_salary / days_in_month) * overlap_days * alloc_pct
                converted_cost = convert_currency(cost_for_month, "INR", currency, current_date)
                total_cost += converted_cost
                
                current_date = next_month
                
            return total_cost
        except Exception as e:
            logger.warning(f"Error calculating allocation cost: {e}")
            return 0.0
            
    project_salary_expenses = {}
    from utils.date_utils import parse_date_from_sheet
    for al in all_allocations:
        status = str(al.get("Status", "")).upper().strip()
        if status in ["CANCELED", "REJECTED", "DRAFT"]:
            continue
            
        pid = str(al.get("Project ID", "")).strip()
        deal_id = project_to_deal_map.get(pid) or pid
        aid = str(al.get("Associate ID", "")).strip()
        
        start_str = al.get("Start Date", "").strip()
        end_str = al.get("End Date", "").strip()
        if not start_str or not end_str:
            continue
            
        d1 = parse_date_from_sheet(start_str)
        d2 = parse_date_from_sheet(end_str)
        if not d1 or not d2:
            continue
            
        alloc_start = datetime.strptime(d1, "%Y-%m-%d")
        alloc_end = datetime.strptime(d2, "%Y-%m-%d")
        
        if alloc_end < alloc_start:
            continue
            
        cost = calculate_allocation_cost(al, aid, alloc_start, alloc_end)
        project_salary_expenses[deal_id] = project_salary_expenses.get(deal_id, 0.0) + cost
        
    # 6. Fetch Expenses -> Other Expenses
    all_expenses = sheets_service.get_all_records(settings.EXPENSES_SHEET)
    project_other_expenses = {}
    for exp in all_expenses:
        status = str(exp.get("Status", "")).upper().strip()
        if status != "PAID": 
            continue
            
        pid = str(exp.get("Project ID", "")).strip()
        deal_id = project_to_deal_map.get(pid) or pid
        amount_str = str(exp.get("Expense") or exp.get("Total Amount INR") or exp.get("Total Amount") or exp.get("total_amount") or "0").replace(",", "").replace("₹", "").strip()
        
        # Expenses are typically recorded in INR when looking at 'Total Amount INR'.
        # If the key was just 'Total Amount' and actually in another currency, 
        # we'd need a separate Currency column, but assuming INR as base for HRMS expenses
        exp_date = str(exp.get("Date", exp.get("Expense Date", "")))
        amount_inr = safe_float(amount_str, 0.0)
        
        # Convert to requested currency
        amount = convert_currency(amount_inr, "INR", currency, exp_date)
        
        project_other_expenses[deal_id] = project_other_expenses.get(deal_id, 0.0) + amount
        
    # 7. Aggregate
    profitability = []
    
    # Process invoices
    project_income = {}
    for inv in all_invoices:
        status = str(inv.get("Status", "")).lower().strip()
        if status == "cancelled":
            continue
        pid = str(inv.get("Deal Id", "")).strip()
        amount_str = str(inv.get("Invoice Total", inv.get("Total Amount")) or "0").replace(",", "").replace("$", "").replace("₹", "").strip()
        raw_amount = safe_float(amount_str, 0.0)
        
        inv_curr = inv.get("Currency", "USD")
        inv_date_str = inv.get("Issue Date", "")
        inv_date_iso = parse_date_from_sheet(inv_date_str)
        
        if inv_date_iso:
            inv_dt = datetime.strptime(inv_date_iso, "%Y-%m-%d")
            if start_date and inv_dt < start_date:
                continue
            if end_date and inv_dt > end_date:
                continue

        amount = convert_currency(raw_amount, inv_curr, currency, inv_date_str)
        
        project_income[pid] = project_income.get(pid, 0.0) + amount
        
    processed_deal_ids = set()
    for d in all_deals:
        deal_id = str(d.get("Deal ID", "")).strip()
        cust_id = str(d.get("Customer ID", "")).strip()
        name = d.get("Deal Name", "")
        
        if deal_id:
            processed_deal_ids.add(deal_id)
        
        income = project_income.get(deal_id, 0.0)
        salary_exp = project_salary_expenses.get(deal_id, 0.0)
        other_exp = project_other_expenses.get(deal_id, 0.0)
        
        if income == 0 and salary_exp == 0 and other_exp == 0:
            continue
            
        net_profit = income - salary_exp - other_exp
        margin = (net_profit / income * 100) if income > 0 else 0.0
        
        profitability.append({
            "deal_id": deal_id,
            "deal_name": name,
            "customer_id": cust_id,
            "customer_name": customer_map.get(cust_id, "Unknown Customer"),
            "income": income,
            "salary_expense": salary_exp,
            "other_expense": other_exp,
            "net_profit": net_profit,
            "margin_percentage": margin
        })
        
    # Add unmapped projects (e.g., internal/investment projects)
    all_cost_keys = set(project_income.keys()).union(set(project_salary_expenses.keys())).union(set(project_other_expenses.keys()))
    unmapped_keys = all_cost_keys - processed_deal_ids
    
    project_info_map = {str(p.get("Project ID", "")).strip(): p for p in all_projects if str(p.get("Project ID", "")).strip()}
    
    for key in unmapped_keys:
        if not key:
            continue
            
        p = project_info_map.get(key, {})
        name = p.get("Project Name", key)
        cust_id = str(p.get("Customer ID", "")).strip()
        
        income = project_income.get(key, 0.0)
        salary_exp = project_salary_expenses.get(key, 0.0)
        other_exp = project_other_expenses.get(key, 0.0)
        
        if income == 0 and salary_exp == 0 and other_exp == 0:
            continue
            
        net_profit = income - salary_exp - other_exp
        margin = (net_profit / income * 100) if income > 0 else 0.0
        
        profitability.append({
            "deal_id": key,
            "deal_name": name + " (Investment/Internal)",
            "customer_id": cust_id,
            "customer_name": customer_map.get(cust_id, "Internal" if not cust_id else "Unknown Customer"),
            "income": income,
            "salary_expense": salary_exp,
            "other_expense": other_exp,
            "net_profit": net_profit,
            "margin_percentage": margin
        })
        
    return {"profitability": profitability}

@router.get("/finance/cashflow")
@trace_exceptions_async
async def get_finance_cashflow(
    currency: str = "INR",
    year: str = "All",
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Get cash flow data showing actual balances and projections."""
    
    start_filter_date, end_filter_date = get_date_range(year)
    
    # 1. Fetch necessary data
    all_deals = sheets_service.get_crms_all_records(settings.CRMS_DEALS_SHEET)
    all_invoices = sheets_service.get_crms_all_records(CRMS_INVOICES_SHEET)
    all_expenses = sheets_service.get_all_records(settings.EXPENSES_SHEET)
    all_allocations = sheets_service.get_all_records(settings.ALLOCATIONS_SHEET)
    all_payroll = sheets_service.get_all_records(settings.PAYROLL_SHEET)
    convert_currency = get_usd_converter()
    
    from utils.date_utils import parse_date_from_sheet
    
    # Track metrics by month-year string e.g., '2024-01'
    monthly_data = {}
    def init_month(ym_str):
        if ym_str not in monthly_data:
            monthly_data[ym_str] = {
                "month_key": ym_str,
                "actual_in": 0.0,
                "actual_out": 0.0,
                "projected_in": 0.0,
                "projected_out": 0.0,
            }
            
    today = datetime.now()
    ym_today = today.strftime("%Y-%m")
    ym_start = "2024-08"
    
    # Calculate limit date (12 months from today)
    limit_date = today + timedelta(days=365)
    ym_limit = limit_date.strftime("%Y-%m")
            
    # --- 1. Process Income (Invoices) ---
    for inv in all_invoices:
        status = str(inv.get("Status", "")).lower().strip()
        if status == "cancelled":
            continue
            
        amount_str = str(inv.get("Invoice Total", inv.get("Total Amount")) or "0").replace(",", "").replace("$", "").replace("₹", "").strip()
        raw_amount = safe_float(amount_str, 0.0)
        if raw_amount <= 0:
            continue
            
        inv_curr = inv.get("Currency", "USD")
        
        if status == "paid":
            # Actual In
            pay_date_str = inv.get("Payment Date") or inv.get("Issue Date") or ""
            d_str = parse_date_from_sheet(pay_date_str)
            if d_str:
                d = datetime.strptime(d_str, "%Y-%m-%d")
                conv_amount = convert_currency(raw_amount, inv_curr, currency, d_str)
                ym_str = d.strftime("%Y-%m")
                init_month(ym_str)
                monthly_data[ym_str]["actual_in"] += conv_amount
        else:
            # Projected In (Sent, Overdue, Draft)
            due_date_str = inv.get("Due Date") or inv.get("Issue Date") or ""
            d_str = parse_date_from_sheet(due_date_str)
            if d_str:
                d = datetime.strptime(d_str, "%Y-%m-%d")
                # If due date is strictly in the past, roll it into current month's projection
                if d < today:
                    d = today
                conv_amount = convert_currency(raw_amount, inv_curr, currency, d.strftime("%Y-%m-%d"))
                ym_str = d.strftime("%Y-%m")
                init_month(ym_str)
                monthly_data[ym_str]["projected_in"] += conv_amount
                
    # --- 2. Process Projections (Active Deals remaining value) ---
    deal_invoiced = {}
    for inv in all_invoices:
        status = str(inv.get("Status", "")).lower().strip()
        if status == "cancelled":
            continue
        did = str(inv.get("Deal Id", "")).strip()
        amount_str = str(inv.get("Invoice Total", inv.get("Total Amount")) or "0").replace(",", "").replace("$", "").replace("₹", "").strip()
        amt = safe_float(amount_str, 0.0)
        # Convert all to a baseline (e.g. USD) for comparison against deal value
        inv_curr = inv.get("Currency", "USD")
        amt_usd = convert_currency(amt, inv_curr, "USD", inv.get("Issue Date", ""))
        deal_invoiced[did] = deal_invoiced.get(did, 0.0) + amt_usd
        
    for d in all_deals:
        did = str(d.get("Deal ID", "")).strip()
        status = str(d.get("Status", "")).lower().strip()
        if "lost" in status or "cancelled" in status:
            continue
            
        end_date_str = parse_date_from_sheet(d.get("End Date", ""))
        val_str = str(d.get("Value", "0")).replace(",", "").replace("$", "").replace("₹", "").strip()
        total_val_usd = convert_currency(safe_float(val_str, 0.0), d.get("Currency", "USD"), "USD", today.strftime("%Y-%m-%d"))
        
        invoiced_usd = deal_invoiced.get(did, 0.0)
        remaining_val_usd = max(0, total_val_usd - invoiced_usd)
        
        if remaining_val_usd > 0 and end_date_str:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
            # If the deal ends in the future, spread the remaining balance over the upcoming months
            if end_date > today:
                months_diff = (end_date.year - today.year) * 12 + (end_date.month - today.month) + 1
                if months_diff > 0:
                    val_per_month_usd = remaining_val_usd / months_diff
                    val_per_month = convert_currency(val_per_month_usd, "USD", currency, today.strftime("%Y-%m-%d"))
                    
                    for i in range(months_diff):
                        proj_date = datetime(today.year, today.month, 1) + timedelta(days=32 * i)
                        proj_date = proj_date.replace(day=1)
                        ym_str = proj_date.strftime("%Y-%m")
                        
                        if ym_str > ym_limit:
                            break
                            
                        init_month(ym_str)
                        monthly_data[ym_str]["projected_in"] += val_per_month
                        
    # --- 3. Process Expenses (Other Expenses) ---
    for exp in all_expenses:
        status = str(exp.get("Status", "")).upper().strip()
        if status != "PAID": 
            continue
            
        amount_str = str(exp.get("Expense") or exp.get("Total Amount INR") or exp.get("Total Amount") or exp.get("total_amount") or "0").replace(",", "").replace("₹", "").strip()
        raw_amount = safe_float(amount_str, 0.0)
        if raw_amount <= 0:
            continue
            
        exp_date_str = str(exp.get("Date", exp.get("Expense Date", "")))
        d_str = parse_date_from_sheet(exp_date_str)
        if d_str:
            d = datetime.strptime(d_str, "%Y-%m-%d")
            exp_curr = exp.get("Currency", "INR")
            conv_amount = convert_currency(raw_amount, exp_curr, currency, d_str)
            ym_str = d.strftime("%Y-%m")
            init_month(ym_str)
            # Historically in the past vs future projections
            if ym_str <= ym_today:
                monthly_data[ym_str]["actual_out"] += conv_amount
            else:
                monthly_data[ym_str]["projected_out"] += conv_amount

    # --- 4. Process Salaries (Allocations) ---
    payroll_map = {}
    for row in all_payroll:
        aid = str(row.get("Employee Code") or row.get("Associate ID") or "").strip()
        year = str(row.get("Year") or row.get("Payroll Year") or "").strip()
        month = str(row.get("Month") or row.get("Payroll Month") or "").strip()
        earnings_str = str(row.get("Earnings", "0")).replace(",", "").replace("₹", "").strip()
        if not safe_float(earnings_str, 0):
            earnings_str = str(row.get("Net Pay", "0")).replace(",", "").replace("₹", "").strip()
        earnings = safe_float(earnings_str, 0.0)
        if aid and year and month:
            payroll_map[(aid, year, month[:3].capitalize())] = earnings
            payroll_map[(aid, year, month.capitalize())] = earnings

    # Extrapolate most recent salary for future projections
    latest_salaries = {}
    for aid, y, m in payroll_map.keys():
        earn = payroll_map[(aid, y, m)]
        if aid not in latest_salaries or earn > latest_salaries[aid]:
            latest_salaries[aid] = earn

    for al in all_allocations:
        status = str(al.get("Status", "")).upper().strip()
        if status in ["CANCELED", "REJECTED", "DRAFT"]:
            continue
            
        aid = str(al.get("Associate ID", "")).strip()
        start_str = al.get("Start Date", "").strip()
        end_str = al.get("End Date", "").strip()
        if not start_str or not end_str:
            continue
            
        d1 = parse_date_from_sheet(start_str)
        d2 = parse_date_from_sheet(end_str)
        if not d1 or not d2:
            continue
            
        alloc_start = datetime.strptime(d1, "%Y-%m-%d")
        alloc_end = datetime.strptime(d2, "%Y-%m-%d")
        if alloc_end < alloc_start:
            continue
            
        alloc_pct = safe_float(str(al.get("Allocation %", "")).replace("%", ""), 100) / 100
        current_date = alloc_start
        
        while current_date <= alloc_end:
            year_str = str(current_date.year)
            month_str_short = current_date.strftime("%b")
            month_str_long = current_date.strftime("%B")
            
            monthly_salary = payroll_map.get((aid, year_str, month_str_long)) or \
                             payroll_map.get((aid, year_str, month_str_short))
                             
            ym_str = current_date.strftime("%Y-%m")
            if ym_str > ym_limit:
                break
                
            is_future = ym_str > ym_today
            
            if monthly_salary is None:
                # If we are projecting future salaries where payroll isn't available yet, use their latest known boundary
                if is_future:
                    monthly_salary = latest_salaries.get(aid, 0.0)
                else:
                    monthly_salary = 0.0
            
            if current_date.month == 12:
                next_month = datetime(current_date.year + 1, 1, 1)
            else:
                next_month = datetime(current_date.year, current_date.month + 1, 1)
                
            month_end = next_month - timedelta(days=1)
            overlap_end = min(alloc_end, month_end)
            overlap_start = max(alloc_start, datetime(current_date.year, current_date.month, 1))
            
            overlap_days = (overlap_end - overlap_start).days + 1
            days_in_month = (month_end - datetime(current_date.year, current_date.month, 1)).days + 1
            
            cost_for_month = (monthly_salary / days_in_month) * overlap_days * alloc_pct
            converted_cost = convert_currency(cost_for_month, "INR", currency, current_date.strftime("%Y-%m-%d"))
            
            init_month(ym_str)
            if is_future:
                monthly_data[ym_str]["projected_out"] += converted_cost
            else:
                monthly_data[ym_str]["actual_out"] += converted_cost
                
            current_date = next_month

    # 5. Format and sort by month
    # We sort all months to calculate cumulative cash correctly, but we might filter for the final result
    all_sorted_months = sorted(monthly_data.keys())
    result = []
    
    cumulative_cash = 0.0
    for ym in all_sorted_months:
        if ym < ym_start:
            continue
            
        entry = monthly_data[ym]
        
        # Inject opening balance of 100k for Aug-2024 as requested
        if ym == "2024-08":
            opening_injection = convert_currency(100000.0, "INR", currency, "2024-08-01")
            cumulative_cash += opening_injection
            
        entry["opening_balance"] = cumulative_cash
        
        net_actual = entry["actual_in"] - entry["actual_out"]
        net_proj = entry["projected_in"] - entry["projected_out"]
        
        # Determine monthly net impact based on actuals/projections relative to today
        m_net = 0.0
        if ym < ym_today:
            m_net = net_actual
        elif ym == ym_today:
            m_net = net_actual + net_proj
        else:
            m_net = net_proj
            
        cumulative_cash += m_net
        entry["closing_balance"] = cumulative_cash
        entry["cumulative_cash"] = cumulative_cash  # Keep for backward compatibility
        
        if ym >= ym_start and ym <= ym_limit:
            # If a year filter is active, only include months in that range
            if start_filter_date and end_filter_date:
                m_dt = datetime.strptime(ym + "-01", "%Y-%m-%d")
                if m_dt >= start_filter_date and m_dt <= end_filter_date:
                    result.append(entry)
            else:
                result.append(entry)
        
    return {"cashflow": result}
