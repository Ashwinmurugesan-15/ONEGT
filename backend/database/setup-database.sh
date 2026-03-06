#!/bin/bash

# Database Setup Script
# Purpose: Execute DDL, Seed, and DML scripts in correct order
# Documentation: scripts/DATABASE_SCRIPTS.md
# ============================================================

set -e  # Exit on any error

echo "========================================"
echo "Assessment Portal - Database Setup"
echo "========================================"
echo ""

# Database configuration
DB_NAME="assessment_engine"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_SUPERUSER="${DB_SUPERUSER:-yugabyte}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📋 Configuration:"
echo "   Database: $DB_NAME"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Superuser: $DB_SUPERUSER"
echo ""

# Determine command
CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_SUPERUSER"


# Step 1: Execute DDL Script
echo "🔧 Step 1: Executing DDL Script (Structure)..."
$CMD -d "$DB_NAME" -f "$SCRIPT_DIR/ddl/ddl.sql"

# Step 2: Execute Seed Data Script
echo ""
echo "🌱 Step 2: Executing Seed Data (Starter Data)..."
PGPASSWORD='assessment_pass_2024' psql -h "$DB_HOST" -p "$DB_PORT" -U assessment_app_user -d "$DB_NAME" -f "$SCRIPT_DIR/seeddata/seed_data.sql"

# Step 3: Execute DML Script
echo ""
echo "✍️ Step 3: Executing DML Script (Business Data)..."
PGPASSWORD='assessment_pass_2024' psql -h "$DB_HOST" -p "$DB_PORT" -U assessment_app_user -d "$DB_NAME" -f "$SCRIPT_DIR/dml/dml.sql"

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✅ Database Setup Complete!"
    echo "========================================"
echo ""
echo "📝 Next Steps:"
echo "1. Update your .env.local file with:"
echo "   DATABASE_URL=postgresql://assessment_app_user:assessment_pass_2024@localhost:5433/assessment_engine?schema=vinavalai_schema"
echo ""
echo "2. Restart your application:"
echo "   npm run dev"
echo ""
echo "3. Login with:"
echo "   Email: admin@assessmentportal.com"
echo "   Password: admin123"
echo ""
echo "========================================"
