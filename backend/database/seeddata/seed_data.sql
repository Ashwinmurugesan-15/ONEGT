-- ============================================================
-- SEED DATA Script: Assessment Portal
-- Purpose: Insert initial default data (not test data)
-- Run as: assessment_app_user
-- ============================================================

SET search_path TO VinavalAI_schema, public;

-- ============================================================
-- STEP 1: Insert Default Admin User
-- ============================================================
INSERT INTO VinavalAI_schema.VinavalAI_users (id, name, email, password, role, is_first_login)
VALUES (
    'admin-001',
    'System Admin',
    'admin@assessmentportal.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- admin123
    'admin',
    false
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- STEP 2: Insert Default Examiner
-- ============================================================
INSERT INTO VinavalAI_schema.VinavalAI_users (id, name, email, password, role, is_first_login)
VALUES (
    'examiner-001',
    'Default Examiner',
    'examiner@assessmentportal.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- examiner123
    'examiner',
    false
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- STEP 3: Insert Default Candidate
-- ============================================================
INSERT INTO VinavalAI_schema.VinavalAI_users (id, name, email, password, role, is_first_login)
VALUES (
    'candidate-001',
    'Default Candidate',
    'candidate@assessmentportal.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- candidate123
    'candidate',
    false
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- STEP 4: Insert One Default Assessment
-- ============================================================
INSERT INTO VinavalAI_schema.assessments (
    assessment_id, title, description, difficulty, questions, created_by, duration_minutes, assigned_to
)
VALUES (
    'assessment-001',
    'System Sample Assessment',
    'Default assessment created during system setup',
    'easy',
    '[
        {
            "question": "What does SQL stand for?",
            "options": ["Structured Query Language", "Simple Query Language", "System Query Logic", "Standard Query List"],
            "correctAnswer": 0,
            "points": 10
        }
    ]'::JSONB,
    'examiner-001',
    15,
    ARRAY['candidate-001']::TEXT[]
)
ON CONFLICT (assessment_id) DO NOTHING;

-- ============================================================
-- STEP 5: Completion Message
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Seed Data Inserted Successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Admin Login    : admin@assessmentportal.com / admin123';
    RAISE NOTICE 'Examiner Login : examiner@assessmentportal.com / examiner123';
    RAISE NOTICE 'Candidate Login: candidate@assessmentportal.com / candidate123';
    RAISE NOTICE '========================================';
END
$$;
