from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
import logging
from services.google_sheets import sheets_service
from models.hrms.payroll import PayrollCreate, normalize_month
from models.hrms.associate import Associate, row_to_associate
from config import settings
from middleware.auth_middleware import get_current_user, require_admin

logger = logging.getLogger("chrms.payrun")

router = APIRouter()

def calculate_payroll_components(fixed_ctc_annual: float):
    """
    Calculate default salary components based on Fixed CTC.
    Logic aligned with SalaryStructure.jsx:
    - Basic: 40% of CTC
    - HRA: 50% of Basic
    - PF (Employer): 12% of Basic, capped at 1800
    - Supplementary: Balancing figure to reach Monthly Gross
    """
    fixed_ctc_monthly = fixed_ctc_annual / 12
    
    basic_annual = fixed_ctc_annual * 0.40
    basic_monthly = basic_annual / 12
    
    hra_monthly = (basic_annual * 0.50) / 12
    
    pf_monthly = basic_monthly * 0.12
    if pf_monthly > 1800:
        pf_monthly = 1800
    
    # Supplementary Allowance = Monthly Gross - (Basic + HRA + PF)
    # Gross Earnings in our system usually means Basic + HRA + Supplementary
    # Statutories usually includes PF
    
    supplementary_monthly = fixed_ctc_monthly - (basic_monthly + hra_monthly + pf_monthly)
    
    earnings = basic_monthly + hra_monthly + supplementary_monthly
    statutories = pf_monthly # Default to just PF
    
    return {
        "earnings": round(earnings, 2),
        "statutories": round(statutories, 2),
        "basic": round(basic_monthly, 2),
        "hra": round(hra_monthly, 2),
        "supplementary": round(supplementary_monthly, 2)
    }

@router.get("/init", response_model=List[dict])
async def init_payrun(
    year: int = Query(...),
    month: str = Query(...),
    current_user = Depends(require_admin)
):
    """
    Initialize a payrun by fetching all active associates and calculating their components.
    """

    try:
        # Fetch all associates
        assoc_records = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
        
        # Robust status check: case-insensitive and handle potential header variations
        associates = []
        for r in assoc_records:
            status = str(r.get("Status") or r.get("status") or "").strip().lower()
            if status == "active":
                associates.append(row_to_associate(r))
        
        logger.info(f"Fetched {len(assoc_records)} total records, found {len(associates)} active associates")
        
        # Fetch existing payroll for this month to check for duplicates (optional, but good for UI)
        existing_payroll_records = sheets_service.get_all_records(settings.PAYROLL_SHEET)
        existing_ids = set()
        for r in existing_payroll_records:
            r_year = r.get("Year") or r.get("Payroll Year")
            r_month = str(r.get("Month") or r.get("Payroll Month", ""))
            if str(r_year) == str(year) and normalize_month(r_month).lower() == normalize_month(month).lower():
                emp_code = r.get("Employee Code") or r.get("Associate ID")
                if emp_code:
                    existing_ids.add(str(emp_code).strip().lower())

        payrun_data = []
        for assoc in associates:
            comp = calculate_payroll_components(assoc.fixed_ctc)
            
            # Prepare initialization record
            payrun_data.append({
                "associate_id": assoc.associate_id,
                "associate_name": assoc.associate_name,
                "department_name": assoc.department_id,
                "designation_name": assoc.designation_id,
                "dob": assoc.dob,
                "join_date": assoc.join_date,
                "fixed_ctc": assoc.fixed_ctc,
                "gender": assoc.gender,
                "currency": assoc.currency,
                "location": assoc.location,
                "country": assoc.country,
                "earnings": comp["earnings"],
                "statutories_amount": comp["statutories"],
                "income_tax": 0,
                "deductions": 0,
                "net_pay": comp["earnings"] - 0 - 0, 
                "is_existing": assoc.associate_id.strip().lower() in existing_ids,
                "payroll_month": month,
                "payroll_year": year,
                "components": comp
            })
            
        return payrun_data
    except Exception as e:
        logger.error(f"Error initializing payrun: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/finalize", response_model=dict)
async def finalize_payrun(
    payrolls: List[PayrollCreate],
    current_user = Depends(require_admin)
):
    """
    Finalize a payrun by saving the list of payroll records.
    Uses the existing append_row logic.
    """

    try:
        from models.hrms.payroll import payroll_to_row
        
        rows = [payroll_to_row(p) for p in payrolls]
        sheets_service.append_rows(settings.PAYROLL_SHEET, rows)
            
        return {"success": True, "message": f"Successfully processed {len(payrolls)} payroll records"}
    except Exception as e:
        logger.error(f"Error finalizing payrun: {e}")
        raise HTTPException(status_code=500, detail=str(e))
