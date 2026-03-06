-- ============================================================
-- INSERT Script: Assessment Portal Sample Data
-- Purpose: Insert comprehensive sample data for testing
-- Run as: assessment_app_user (NOT postgres)
-- ============================================================

SET search_path TO VinavalAI_schema, public;

-- ============================================================
-- STEP 1: Insert Sample Users
-- ============================================================
-- Note: Passwords are bcrypt hashed (plaintext shown in comments)

-- Admin User
INSERT INTO VinavalAI_schema.VinavalAI_users (id, name, email, password, role, created_at, is_first_login)
VALUES (
    'admin-001',
    'Admin User',
    'admin@assessmentportal.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- admin123
    'admin',
    CURRENT_TIMESTAMP,
    false
) ON CONFLICT (email) DO NOTHING;

-- Examiner Users
INSERT INTO VinavalAI_schema.VinavalAI_users (id, name, email, password, role, created_at, is_first_login, created_assessments)
VALUES 
(
    'examiner-001',
    'Sarah Johnson',
    'sarah.johnson@assessmentportal.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- examiner123
    'examiner',
    CURRENT_TIMESTAMP,
    false,
    ARRAY[]::TEXT[]
),
(
    'examiner-002',
    'Mike Chen',
    'mike.chen@assessmentportal.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- examiner123
    'examiner',
    CURRENT_TIMESTAMP,
    false,
    ARRAY[]::TEXT[]
),
(
    'examiner-003',
    'Emily Rodriguez',
    'emily.rodriguez@assessmentportal.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- examiner123
    'examiner',
    CURRENT_TIMESTAMP,
    false,
    ARRAY[]::TEXT[]
)
ON CONFLICT (email) DO NOTHING;

-- Candidate Users
INSERT INTO VinavalAI_schema.VinavalAI_users (id, name, email, password, role, created_at, is_first_login, assigned_assessments)
VALUES 
(
    'candidate-001',
    'Alice Thompson',
    'alice.thompson@example.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- candidate123
    'candidate',
    CURRENT_TIMESTAMP,
    false,
    ARRAY[]::TEXT[]
),
(
    'candidate-002',
    'Bob Williams',
    'bob.williams@example.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- candidate123
    'candidate',
    CURRENT_TIMESTAMP,
    false,
    ARRAY[]::TEXT[]
),
(
    'candidate-003',
    'Carol Davis',
    'carol.davis@example.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- candidate123
    'candidate',
    CURRENT_TIMESTAMP,
    false,
    ARRAY[]::TEXT[]
),
(
    'candidate-004',
    'David Martinez',
    'david.martinez@example.com',
    '$2a$10$rN8qKZHxqGKJwGwP5VxZVOYvKX3p7KlZqV5qFZqVZqVZqVZqVZqVZ', -- candidate123
    'candidate',
    CURRENT_TIMESTAMP,
    false,
    ARRAY[]::TEXT[]
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- STEP 2: Insert Sample Assessments
-- ============================================================

-- Assessment 1: Easy JavaScript Basics
INSERT INTO VinavalAI_schema.assessments (
    assessment_id, title, description, difficulty, questions, created_by, created_at, 
    duration_minutes, assigned_to
)
VALUES (
    'assessment-001',
    'JavaScript Fundamentals - Easy',
    'Basic JavaScript concepts for beginners',
    'easy',
    '[
        {
            "question": "What is the correct syntax to print a message in JavaScript?",
            "options": ["console.log()", "print()", "echo()", "System.out.println()"],
            "correctAnswer": 0,
            "points": 10
        },
        {
            "question": "Which keyword is used to declare a variable in JavaScript?",
            "options": ["var", "int", "string", "dim"],
            "correctAnswer": 0,
            "points": 10
        },
        {
            "question": "What does === operator do in JavaScript?",
            "options": ["Assignment", "Strict equality check", "Addition", "Comparison"],
            "correctAnswer": 1,
            "points": 10
        }
    ]'::JSONB,
    'examiner-001',
    CURRENT_TIMESTAMP,
    30,
    ARRAY['candidate-001', 'candidate-002']::TEXT[]
) ON CONFLICT (assessment_id) DO NOTHING;

-- Assessment 2: Medium React Concepts
INSERT INTO VinavalAI_schema.assessments (
    assessment_id, title, description, difficulty, questions, created_by, created_at, 
    duration_minutes, assigned_to
)
VALUES (
    'assessment-002',
    'React.js Components - Medium',
    'Understanding React components and hooks',
    'medium',
    '[
        {
            "question": "What is the purpose of useState hook in React?",
            "options": ["To manage component state", "To fetch data", "To style components", "To route pages"],
            "correctAnswer": 0,
            "points": 15
        },
        {
            "question": "Which method is used to render React components?",
            "options": ["ReactDOM.render()", "React.display()", "component.show()", "render.component()"],
            "correctAnswer": 0,
            "points": 15
        },
        {
            "question": "What is JSX in React?",
            "options": ["A database", "JavaScript XML syntax", "A styling library", "A testing framework"],
            "correctAnswer": 1,
            "points": 15
        },
        {
            "question": "How do you pass data from parent to child component?",
            "options": ["Using state", "Using props", "Using context", "Using refs"],
            "correctAnswer": 1,
            "points": 15
        }
    ]'::JSONB,
    'examiner-002',
    CURRENT_TIMESTAMP,
    45,
    ARRAY['candidate-001', 'candidate-003']::TEXT[]
) ON CONFLICT (assessment_id) DO NOTHING;

-- Assessment 3: Medium Node.js Backend
INSERT INTO VinavalAI_schema.assessments (
    assessment_id, title, description, difficulty, questions, created_by, created_at, 
    duration_minutes, assigned_to
)
VALUES (
    'assessment-003',
    'Node.js Backend Development - Medium',
    'Express.js and REST API concepts',
    'medium',
    '[
        {
            "question": "What is Express.js?",
            "options": ["A database", "A web framework for Node.js", "A frontend library", "A testing tool"],
            "correctAnswer": 1,
            "points": 15
        },
        {
            "question": "Which HTTP method is used to create a new resource?",
            "options": ["GET", "POST", "PUT", "DELETE"],
            "correctAnswer": 1,
            "points": 15
        },
        {
            "question": "What is middleware in Express?",
            "options": ["A database connector", "Functions that execute during request lifecycle", "A routing method", "A template engine"],
            "correctAnswer": 1,
            "points": 15
        }
    ]'::JSONB,
    'examiner-002',
    CURRENT_TIMESTAMP,
    40,
    ARRAY['candidate-002', 'candidate-004']::TEXT[]
) ON CONFLICT (assessment_id) DO NOTHING;

-- Assessment 4: Hard TypeScript Advanced
INSERT INTO VinavalAI_schema.assessments (
    assessment_id, title, description, difficulty, questions, created_by, created_at, 
    duration_minutes, assigned_to
)
VALUES (
    'assessment-004',
    'TypeScript Advanced Concepts - Hard',
    'Advanced TypeScript features and patterns',
    'hard',
    '[
        {
            "question": "What is the purpose of generics in TypeScript?",
            "options": ["To create reusable type-safe components", "To style components", "To manage state", "To route pages"],
            "correctAnswer": 0,
            "points": 20
        },
        {
            "question": "What does the keyof operator do?",
            "options": ["Creates a key", "Gets keys of an object type", "Deletes a key", "Checks key existence"],
            "correctAnswer": 1,
            "points": 20
        },
        {
            "question": "What is a utility type in TypeScript?",
            "options": ["A debugging tool", "A built-in type transformation", "A testing framework", "A linter"],
            "correctAnswer": 1,
            "points": 20
        }
    ]'::JSONB,
    'examiner-003',
    CURRENT_TIMESTAMP,
    60,
    ARRAY['candidate-001', 'candidate-004']::TEXT[]
) ON CONFLICT (assessment_id) DO NOTHING;

-- Assessment 5: Hard Database Design
INSERT INTO VinavalAI_schema.assessments (
    assessment_id, title, description, difficulty, questions, created_by, created_at, 
    duration_minutes, assigned_to
)
VALUES (
    'assessment-005',
    'Database Design & SQL - Hard',
    'Advanced database concepts and query optimization',
    'hard',
    '[
        {
            "question": "What is database normalization?",
            "options": ["Backup process", "Organizing data to reduce redundancy", "Encryption method", "Query optimization"],
            "correctAnswer": 1,
            "points": 20
        },
        {
            "question": "What is an index in a database?",
            "options": ["A table column", "A data structure for faster lookups", "A backup file", "A user role"],
            "correctAnswer": 1,
            "points": 20
        },
        {
            "question": "What does ACID stand for in databases?",
            "options": ["Advanced Custom Integration Data", "Atomicity Consistency Isolation Durability", "Automatic Cache Index Database", "None"],
            "correctAnswer": 1,
            "points": 20
        }
    ]'::JSONB,
    'examiner-003',
    CURRENT_TIMESTAMP,
    60,
    ARRAY['candidate-003', 'candidate-004']::TEXT[]
) ON CONFLICT (assessment_id) DO NOTHING;

-- ============================================================
-- STEP 3: Insert Sample Results
-- ============================================================

-- Result 1: Alice completed JavaScript assessment
INSERT INTO VinavalAI_schema.results (assessment_id, user_id, result, timestamp)
VALUES (
    'assessment-001',
    'candidate-001',
    '{
        "totalScore": 30,
        "maxScore": 30,
        "percentage": 100,
        "passed": true,
        "answers": [
            {"questionIndex": 0, "selectedAnswer": 0, "isCorrect": true, "points": 10},
            {"questionIndex": 1, "selectedAnswer": 0, "isCorrect": true, "points": 10},
            {"questionIndex": 2, "selectedAnswer": 1, "isCorrect": true, "points": 10}
        ]
    }'::JSONB,
    CURRENT_TIMESTAMP - INTERVAL '2 days'
);

-- Result 2: Bob completed JavaScript assessment
INSERT INTO VinavalAI_schema.results (assessment_id, user_id, result, timestamp)
VALUES (
    'assessment-001',
    'candidate-002',
    '{
        "totalScore": 20,
        "maxScore": 30,
        "percentage": 66.67,
        "passed": true,
        "answers": [
            {"questionIndex": 0, "selectedAnswer": 0, "isCorrect": true, "points": 10},
            {"questionIndex": 1, "selectedAnswer": 0, "isCorrect": true, "points": 10},
            {"questionIndex": 2, "selectedAnswer": 0, "isCorrect": false, "points": 0}
        ]
    }'::JSONB,
    CURRENT_TIMESTAMP - INTERVAL '1 day'
);

-- Result 3: Alice completed React assessment
INSERT INTO VinavalAI_schema.results (assessment_id, user_id, result, timestamp)
VALUES (
    'assessment-002',
    'candidate-001',
    '{
        "totalScore": 45,
        "maxScore": 60,
        "percentage": 75,
        "passed": true,
        "answers": [
            {"questionIndex": 0, "selectedAnswer": 0, "isCorrect": true, "points": 15},
            {"questionIndex": 1, "selectedAnswer": 0, "isCorrect": true, "points": 15},
            {"questionIndex": 2, "selectedAnswer": 1, "isCorrect": true, "points": 15},
            {"questionIndex": 3, "selectedAnswer": 0, "isCorrect": false, "points": 0}
        ]
    }'::JSONB,
    CURRENT_TIMESTAMP - INTERVAL '3 hours'
);

-- ============================================================
-- STEP 4: Insert Sample Learning Resources
-- ============================================================

-- Create learning_resources table if it doesn't exist in the schema
CREATE TABLE IF NOT EXISTS VinavalAI_schema.learning_resources (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    course_url TEXT NOT NULL,
    url_type VARCHAR(50) NOT NULL CHECK (url_type IN ('youtube', 'generic')),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES VinavalAI_schema.VinavalAI_users(id) ON DELETE CASCADE
);

-- Create indexes for learning resources
CREATE INDEX IF NOT EXISTS idx_learning_resources_created_by ON VinavalAI_schema.learning_resources(created_by);
CREATE INDEX IF NOT EXISTS idx_learning_resources_created_at ON VinavalAI_schema.learning_resources(created_at);

-- Insert learning resources
INSERT INTO VinavalAI_schema.learning_resources (id, title, description, course_url, url_type, created_by)
VALUES 
(
    'resource-001',
    'JavaScript Fundamentals',
    'Complete guide to JavaScript basics including variables, functions, arrays, and objects. Perfect for beginners starting their programming journey.',
    'https://www.youtube.com/watch?v=PkZNo7MFNFg',
    'youtube',
    'admin-001'
),
(
    'resource-002',
    'React.js Tutorial',
    'Learn React from scratch with this comprehensive tutorial. Covers components, hooks, state management, and modern React patterns.',
    'https://www.youtube.com/watch?v=SqcY0GlETPk',
    'youtube',
    'admin-001'
),
(
    'resource-003',
    'Node.js Backend Development',
    'Build powerful backend applications with Node.js. Learn Express, REST APIs, databases, and authentication.',
    'https://www.youtube.com/watch?v=Oe421EPjeBE',
    'youtube',
    'admin-001'
),
(
    'resource-004',
    'TypeScript Complete Course',
    'Master TypeScript from basics to advanced. Understand type system, interfaces, generics, and write type-safe applications.',
    'https://www.youtube.com/watch?v=BwuLxPH8IDs',
    'youtube',
    'admin-001'
),
(
    'resource-005',
    'Official MDN Web Docs',
    'Comprehensive web development documentation covering HTML, CSS, JavaScript, and web APIs. Your go-to reference for web development.',
    'https://developer.mozilla.org/en-US/',
    'generic',
    'admin-001'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Completion Message
-- ============================================================
DO $$
DECLARE
    user_count INTEGER;
    assessment_count INTEGER;
    result_count INTEGER;
    resource_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM VinavalAI_schema.VinavalAI_users;
    SELECT COUNT(*) INTO assessment_count FROM VinavalAI_schema.assessments;
    SELECT COUNT(*) INTO result_count FROM VinavalAI_schema.results;
    SELECT COUNT(*) INTO resource_count FROM VinavalAI_schema.learning_resources;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Insert Script Execution Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Users inserted: %', user_count;
    RAISE NOTICE 'Assessments inserted: %', assessment_count;
    RAISE NOTICE 'Results inserted: %', result_count;
    RAISE NOTICE 'Learning Resources inserted: %', resource_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Login Credentials:';
    RAISE NOTICE 'Admin: admin@assessmentportal.com / admin123';
    RAISE NOTICE 'Examiner: sarah.johnson@assessmentportal.com / examiner123';
    RAISE NOTICE 'Candidate: alice.thompson@example.com / candidate123';
    RAISE NOTICE '========================================';
END
$$;
