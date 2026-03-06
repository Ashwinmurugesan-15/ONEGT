-- ============================================================
-- DDL Script: Assessment Portal Database
-- Purpose: Create dedicated user, schema, and tables
-- Follow proper security practices
-- ============================================================

-- ============================================================
-- STEP 1: Create Dedicated Database User
-- ============================================================
-- Note: Run this as postgres superuser initially
DO $$
BEGIN
    -- Create application user if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles WHERE rolname = 'assessment_app_user'
    ) THEN
        CREATE USER assessment_app_user WITH PASSWORD 'assessment_pass_2024';
        RAISE NOTICE 'Created user: assessment_app_user';
    ELSE
        RAISE NOTICE 'User assessment_app_user already exists';
    END IF;
END
$$;

-- ============================================================
-- STEP 2: Create Dedicated Schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS VinavalAI_schema;

-- ============================================================
-- STEP 3: Assign Schema to User
-- ============================================================
-- Grant schema ownership and permissions
ALTER SCHEMA VinavalAI_schema OWNER TO assessment_app_user;

-- Grant necessary privileges
GRANT ALL PRIVILEGES ON SCHEMA VinavalAI_schema TO assessment_app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA VinavalAI_schema TO assessment_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA VinavalAI_schema TO assessment_app_user;

-- Grant usage on public schema for extensions if needed
GRANT USAGE ON SCHEMA public TO assessment_app_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA VinavalAI_schema
    GRANT ALL PRIVILEGES ON TABLES TO assessment_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA VinavalAI_schema
    GRANT ALL PRIVILEGES ON SEQUENCES TO assessment_app_user;

-- ============================================================
-- STEP 4: Create Tables in Dedicated Schema
-- ============================================================
-- From this point, tables are created by the dedicated user in the dedicated schema

-- Set search path to the dedicated schema
SET search_path TO VinavalAI_schema, public;

-- ------------------------------------------------------------
-- VinavalAI_users Table
-- Stores candidates, examiners, and admins
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS VinavalAI_schema.VinavalAI_users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('candidate', 'examiner', 'admin')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_first_login BOOLEAN DEFAULT true,
    assigned_assessments TEXT[], -- For candidates
    created_assessments TEXT[] -- For examiners
);

COMMENT ON TABLE VinavalAI_schema.VinavalAI_users IS 'Stores all user accounts including candidates, examiners, and administrators';
COMMENT ON COLUMN VinavalAI_schema.VinavalAI_users.id IS 'Unique user identifier';
COMMENT ON COLUMN VinavalAI_schema.VinavalAI_users.role IS 'User role: candidate, examiner, or admin';
COMMENT ON COLUMN VinavalAI_schema.VinavalAI_users.assigned_assessments IS 'Assessment IDs assigned to candidates';
COMMENT ON COLUMN VinavalAI_schema.VinavalAI_users.created_assessments IS 'Assessment IDs created by examiners';

-- ------------------------------------------------------------
-- Assessments Table
-- Stores assessment metadata and questions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS VinavalAI_schema.assessments (
    assessment_id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    difficulty VARCHAR(50),
    questions JSONB NOT NULL, -- Stores array of QuestionWithAnswer objects
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_for TIMESTAMP,
    scheduled_from TIMESTAMP,
    scheduled_to TIMESTAMP,
    duration_minutes INTEGER,
    assigned_to TEXT[] NOT NULL DEFAULT '{}', -- Array of candidate IDs
    retake_permissions TEXT[] DEFAULT '{}', -- Array of candidate IDs allowed to retake
    FOREIGN KEY (created_by) REFERENCES VinavalAI_schema.VinavalAI_users(id) ON DELETE CASCADE
);

COMMENT ON TABLE VinavalAI_schema.assessments IS 'Stores assessment definitions including questions and metadata';
COMMENT ON COLUMN VinavalAI_schema.assessments.questions IS 'JSONB array containing question objects with answers';
COMMENT ON COLUMN VinavalAI_schema.assessments.assigned_to IS 'Array of candidate user IDs assigned to this assessment';
COMMENT ON COLUMN VinavalAI_schema.assessments.retake_permissions IS 'Candidates allowed to retake the assessment';

-- ------------------------------------------------------------
-- Results Table
-- Stores assessment results and grading
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS VinavalAI_schema.results (
    id SERIAL PRIMARY KEY,
    assessment_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    result JSONB NOT NULL, -- Stores GradingResult object
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES VinavalAI_schema.assessments(assessment_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES VinavalAI_schema.VinavalAI_users(id) ON DELETE CASCADE
);

COMMENT ON TABLE VinavalAI_schema.results IS 'Stores assessment results and grading data';
COMMENT ON COLUMN VinavalAI_schema.results.result IS 'JSONB object containing grading results and analytics';

-- ============================================================
-- STEP 5: Create Indexes for Performance
-- ============================================================
-- Indexes on VinavalAI_users table
CREATE INDEX IF NOT EXISTS idx_users_email ON VinavalAI_schema.VinavalAI_users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON VinavalAI_schema.VinavalAI_users(role);

-- Indexes on assessments table
CREATE INDEX IF NOT EXISTS idx_assessments_created_by ON VinavalAI_schema.assessments(created_by);
CREATE INDEX IF NOT EXISTS idx_assessments_assigned_to ON VinavalAI_schema.assessments USING GIN(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assessments_difficulty ON VinavalAI_schema.assessments(difficulty);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON VinavalAI_schema.assessments(created_at);

-- Indexes on results table
CREATE INDEX IF NOT EXISTS idx_results_assessment_id ON VinavalAI_schema.results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_results_user_id ON VinavalAI_schema.results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_assessment_user ON VinavalAI_schema.results(assessment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_results_timestamp ON VinavalAI_schema.results(timestamp);

-- ============================================================
-- STEP 6: Grant Connection Privileges
-- ============================================================
-- Allow user to connect to the database
GRANT CONNECT ON DATABASE assessment_engine TO assessment_app_user;

-- ============================================================
-- Completion Message
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DDL Script Execution Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database User: assessment_app_user';
    RAISE NOTICE 'Schema: VinavalAI_schema';
    RAISE NOTICE 'Tables Created: VinavalAI_users, assessments, results';
    RAISE NOTICE 'Indexes Created: 10 indexes for performance';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next Step: Run insert.sql to populate sample data';
    RAISE NOTICE '========================================';
END
$$;
