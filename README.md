# ThiranX - GuhaTek's People & Project Management System

A comprehensive People and Project management system built with Python/FastAPI backend and React frontend, using Google Sheets as the database.

## Features

- **Associates Management**: Track employee information, experience, salary details
- **Projects Management**: Manage projects, SOWs, and client information
- **Resource Allocation**: Track associate allocations to projects with monthly views
- **Invoice Management**: Create and track invoices with multiple line items
- **Payroll**: View and manage payroll data with department breakdowns
- **Expense Tracking**: Track project and general expenses by category
- **Currency Rates**: Manage monthly currency conversion rates
- **Customer CRM**: Maintain customer/client information
- **Timesheets**: Track time spent on projects
- **Analytics Dashboard**: Comprehensive business insights and KPIs

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, gspread (Google Sheets API)
- **Frontend**: React 18, Vite, React Router, Recharts, React Hook Form
- **Database**: Google Sheets
- **Styling**: Custom CSS with design system

## Prerequisites

1. Python 3.11 or higher
2. Node.js 20.19+ or 22.12+
3. Google Cloud Service Account with Sheets API enabled

## Setup

### 1. Google Cloud Setup

1. Create a Google Cloud project
2. Enable the Google Sheets API
3. Create a Service Account and download the JSON key file
4. Share your Google Sheets with the service account email (found in the JSON key)

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file from example
cp .env.example .env

# Edit .env and add:
# - Path to your Google credentials JSON file
# - Your Google Sheets spreadsheet ID
# - Sheet names (optional, defaults provided)
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

## Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: http://localhost:8000
API documentation at: http://localhost:8000/docs

### Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

## Google Sheets Structure

The system expects the following sheets in your Google Spreadsheet:

| Sheet Name | Description |
|------------|-------------|
| Associates | Employee master data |
| Project Master | Projects and SOWs |
| Project Allocation Tracker | Resource allocations |
| Invoice | Invoice records |
| Payroll | Monthly payroll data |
| Expenses | Expense tracking |
| Currency | Monthly exchange rates |
| Customers | Customer/client data |
| Timesheets | Time tracking entries |

## API Endpoints

### Associates
- `GET /api/associates/` - List all associates
- `POST /api/associates/` - Create associate
- `GET /api/associates/{id}` - Get associate by ID
- `PUT /api/associates/{id}` - Update associate
- `DELETE /api/associates/{id}` - Delete associate

### Projects
- `GET /api/projects/` - List all projects
- `POST /api/projects/` - Create project
- `GET /api/projects/{id}` - Get project by ID
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

### Dashboard
- `GET /api/dashboard/overview` - High-level metrics
- `GET /api/dashboard/allocation-by-month?year=&month=` - Monthly allocations
- `GET /api/dashboard/project-profitability` - Profit reports
- `GET /api/dashboard/revenue-trend?year=` - Revenue trends
- `GET /api/dashboard/department-summary` - Department stats
- `GET /api/dashboard/utilization?year=&month=` - Resource utilization

For complete API documentation, visit http://localhost:8000/docs when the backend is running.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| GOOGLE_CREDENTIALS_FILE | Path to service account JSON | credentials.json |
| SPREADSHEET_ID | Google Sheets spreadsheet ID | (required) |
| ASSOCIATES_SHEET | Associates sheet name | Associates |
| PROJECTS_SHEET | Projects sheet name | Project Master |
| ALLOCATIONS_SHEET | Allocations sheet name | Project Allocation Tracker |
| INVOICES_SHEET | Invoices sheet name | Invoice |
| PAYROLL_SHEET | Payroll sheet name | Payroll |
| EXPENSES_SHEET | Expenses sheet name | Expenses |
| CURRENCY_SHEET | Currency sheet name | Currency |
| CUSTOMERS_SHEET | Customers sheet name | Customers |
| TIMESHEETS_SHEET | Timesheets sheet name | Timesheets |

## Project Structure

```
chrms/
├── backend/
│   ├── main.py              # FastAPI application entry
│   ├── config.py            # Configuration from env
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment template
│   ├── models/              # Pydantic data models
│   │   ├── associate.py
│   │   ├── project.py
│   │   ├── allocation.py
│   │   ├── invoice.py
│   │   ├── payroll.py
│   │   ├── expense.py
│   │   ├── currency.py
│   │   ├── customer.py
│   │   └── timesheet.py
│   ├── routers/             # API route handlers
│   │   ├── associates.py
│   │   ├── projects.py
│   │   ├── allocations.py
│   │   ├── invoices.py
│   │   ├── payroll.py
│   │   ├── expenses.py
│   │   ├── currency.py
│   │   ├── customers.py
│   │   ├── timesheets.py
│   │   └── dashboard.py
│   └── services/            # Business logic
│       └── google_sheets.py # Google Sheets integration
│
└── frontend/
    ├── src/
    │   ├── App.jsx          # Main app with routing
    │   ├── main.jsx         # React entry point
    │   ├── index.css        # Global styles/design system
    │   ├── components/      # Reusable UI components
    │   │   ├── common/
    │   │   │   ├── DataTable.jsx
    │   │   │   ├── Modal.jsx
    │   │   │   ├── Loading.jsx
    │   │   │   └── StatCard.jsx
    │   │   └── layout/
    │   │       ├── Layout.jsx
    │   │       └── Sidebar.jsx
    │   ├── pages/           # Page components
    │   │   ├── Dashboard.jsx
    │   │   ├── Associates.jsx
    │   │   ├── Projects.jsx
    │   │   ├── Allocations.jsx
    │   │   ├── Invoices.jsx
    │   │   ├── Payroll.jsx
    │   │   ├── Expenses.jsx
    │   │   ├── CurrencyRates.jsx
    │   │   ├── Customers.jsx
    │   │   ├── Timesheets.jsx
    │   │   └── Settings.jsx
    │   └── services/
    │       └── api.js       # API client
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## License

MIT
