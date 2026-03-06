import os
import logging
import traceback
import sys
import asyncio
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from config import settings
from utils.logging_utils import trace_exceptions_async

# Configure logging
log_level = logging.DEBUG if settings.DEBUG else getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("chrms")
logger.setLevel(log_level)

# Also set uvicorn loggers
logging.getLogger("uvicorn").setLevel(log_level)
logging.getLogger("uvicorn.error").setLevel(log_level)

# Import routers
# Import routers
from routers.hrms import associates, projects, allocations, payroll, expenses, dashboard, timesheets, customers, skills, assets, organization, payrun, settings as settings_router, performance as performance_router, leaves as leaves_router
from routers.common import currency, notifications, drive as drive_router
from routers.common import auth as auth_router

# Import CRMS routers
from routers.crms import leads as crms_leads, customers as crms_customers, opportunities as crms_opportunities, contacts as crms_contacts, deals as crms_deals, tasks as crms_tasks, calls as crms_calls, dashboard as crms_dashboard, invoices as crms_invoices, invoice_templates as crms_invoice_templates

# Import Talent routers
from routers.talent import candidates as talent_candidates, demands as talent_demands, interviews as talent_interviews, email as talent_email

# Import Assessment routers
from routers.assessment import admin as assessment_admin, assessments as assessment_router, candidate as assessment_candidate, examiner as assessment_examiner, learning as assessment_learning

app = FastAPI(
    title="OneGT API",
    description="OneGT API",
    version="1.0.0"
)

# Middleware to log all requests and catch errors
class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            # Log the full exception with stack trace
            error_header = f"ERROR in {request.method} {request.url.path}"
            logger.error(error_header, exc_info=True)
            
            # Also print to stderr for immediate visibility in console
            print(f"\n{'='*60}\n{error_header}\n{'='*60}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            print(f"{'='*60}\n", file=sys.stderr)
            
            return JSONResponse(
                status_code=500,
                content={"detail": str(exc), "type": type(exc).__name__}
            )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_header = f"VALIDATION ERROR in {request.method} {request.url.path}"
    logger.error(f"{error_header}: {exc.errors()}")
    
    # Print to stderr for immediate visibility
    print(f"\n{'!'*60}\n{error_header}\n{'!'*60}", file=sys.stderr)
    for err in exc.errors():
        print(f"  - Loc: {err.get('loc')}\n    Msg: {err.get('msg')}\n    Type: {err.get('type')}", file=sys.stderr)
    print(f"{'!'*60}\n", file=sys.stderr)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body}
    )

app.add_middleware(ErrorLoggingMiddleware)

# Static files directory (for production deployment)
STATIC_DIR = Path(__file__).parent / "static"

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(organization.router, prefix="/api/organization", tags=["Organization"])
app.include_router(crms_invoice_templates.router, prefix="/api/crms/invoice-templates", tags=["CRMS Invoice Templates"])

app.include_router(associates.router, prefix="/api/associates", tags=["Associates"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(allocations.router, prefix="/api/allocations", tags=["Allocations"])
app.include_router(payroll.router, prefix="/api/payroll", tags=["Payroll"])
app.include_router(payrun.router, prefix="/api/payrun", tags=["Payrun"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"])
app.include_router(currency.router, prefix="/api/currency", tags=["Currency"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(timesheets.router, prefix="/api/timesheets", tags=["Timesheets"])
app.include_router(leaves_router.router, prefix="/api/leaves", tags=["Leaves"])
app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
app.include_router(skills.router, prefix="/api/skills", tags=["Skills"])
app.include_router(assets.router, prefix="/api/assets", tags=["Assets"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])
app.include_router(performance_router.router, prefix="/api/performance", tags=["Performance"])
app.include_router(drive_router.router, prefix="/api/common", tags=["Common"])
app.include_router(talent_candidates.router, prefix="/api/talent", tags=["Talent - Candidates"])
app.include_router(talent_demands.router, prefix="/api/talent", tags=["Talent - Demands"])
app.include_router(talent_interviews.router, prefix="/api/talent", tags=["Talent - Interviews"])
app.include_router(talent_email.router, prefix="/api/talent", tags=["Talent - Email"])

# Assessment routers (ordered most specific to least specific)
app.include_router(assessment_candidate.router, prefix="/api/assessment/candidate", tags=["Assessment - Candidate"])
app.include_router(assessment_examiner.router, prefix="/api/assessment/examiner", tags=["Assessment - Examiner"])
app.include_router(assessment_admin.router, prefix="/api/assessment/admin", tags=["Assessment - Admin"])
app.include_router(assessment_learning.router, prefix="/api/assessment/learning", tags=["Assessment - Learning"])
app.include_router(assessment_router.router, prefix="/api/assessment", tags=["Assessment"])

# CRMS routers
app.include_router(crms_leads.router, prefix="/api")
app.include_router(crms_customers.router, prefix="/api")
app.include_router(crms_opportunities.router, prefix="/api")
app.include_router(crms_contacts.router, prefix="/api")
app.include_router(crms_deals.router, prefix="/api")
app.include_router(crms_tasks.router, prefix="/api")
app.include_router(crms_calls.router, prefix="/api")
app.include_router(crms_invoices.router, prefix="/api")
app.include_router(crms_invoice_templates.router, prefix="/api")
app.include_router(crms_dashboard.router, prefix="/api")

@app.get("/")
async def root():
    # In production with static files, serve index.html
    if STATIC_DIR.exists():
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
    return {"message": "OneGT API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Mount static files for production (must be after API routes)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
    
    # Catch-all route for SPA - must be last
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't serve API routes through this
        if full_path.startswith("api/"):
            return {"error": "Not found"}
        
        # Try to serve the file if it exists
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # Fall back to index.html for SPA routing
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        
        return {"error": "Not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)

