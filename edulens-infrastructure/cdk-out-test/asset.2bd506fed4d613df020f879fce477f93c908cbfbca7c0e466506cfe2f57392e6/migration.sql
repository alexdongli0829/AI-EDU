-- ============================================================
-- EduLens v3 — Complete Database Schema
-- Fresh deployment to us-west-2
-- Run via migration Lambda (scripts/db-migration/index.js)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shared trigger function for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email        VARCHAR(255) UNIQUE NOT NULL,
    name         VARCHAR(255) NOT NULL,
    role         VARCHAR(50) NOT NULL CHECK (role IN ('student', 'parent', 'admin')),
    password_hash VARCHAR(255) NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- core_profile (JSONB): stage-agnostic persistent traits.
-- Holds error_patterns (lifetime distribution), time_behavior, and
-- competitive_performance. This is the Core Layer of the v3 Learning DNA.
-- The Stage Layer lives in student_stages.stage_profile.
CREATE TABLE IF NOT EXISTS students (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grade_level  INTEGER NOT NULL CHECK (grade_level >= 1 AND grade_level <= 12),
    date_of_birth DATE NOT NULL,
    parent_id    UUID REFERENCES users(id),
    core_profile JSONB DEFAULT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id);

DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- STAGE MODEL
-- ============================================================

-- Stage definitions: 'oc_prep', 'selective', 'hsc', 'lifelong'
-- test_formats JSONB: { questionCount, durationSecs, sections[] }
-- student_agent_prompt / parent_agent_prompt: stage-specific system prompts
CREATE TABLE IF NOT EXISTS stages (
    id                   VARCHAR(50) PRIMARY KEY,
    display_name         VARCHAR(255) NOT NULL,
    test_formats         JSONB NOT NULL DEFAULT '{}',
    student_agent_prompt TEXT DEFAULT NULL,
    parent_agent_prompt  TEXT DEFAULT NULL,
    sort_order           INTEGER NOT NULL DEFAULT 0,
    is_active            BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Per-stage skill taxonomies (the skill tree for each stage)
-- categories JSONB: { section: { label, skills: { skill_key: { label, weight } } } }
-- extends_id: optionally inherits from another taxonomy (e.g. selective extends oc_prep)
CREATE TABLE IF NOT EXISTS skill_taxonomies (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id   VARCHAR(50) NOT NULL REFERENCES stages(id),
    version    VARCHAR(50) NOT NULL,
    categories JSONB NOT NULL DEFAULT '{}',
    extends_id UUID DEFAULT NULL REFERENCES skill_taxonomies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stage_id, version)
);

CREATE INDEX IF NOT EXISTS idx_skill_taxonomies_stage ON skill_taxonomies(stage_id);

-- Cross-stage skill mappings: how mastery transfers when a student moves stages.
-- prior_weight (0.0–1.0): fraction of source mastery carried into the new stage.
CREATE TABLE IF NOT EXISTS skill_bridges (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_stage_id VARCHAR(50) NOT NULL,
    from_skill   VARCHAR(255) NOT NULL,
    to_stage_id  VARCHAR(50) NOT NULL,
    to_skill     VARCHAR(255) NOT NULL,
    prior_weight FLOAT NOT NULL DEFAULT 0.5 CHECK (prior_weight >= 0 AND prior_weight <= 1)
);

CREATE INDEX IF NOT EXISTS idx_skill_bridges_stages ON skill_bridges(from_stage_id, to_stage_id);

-- Student enrollment record for a stage.
-- stage_profile JSONB: the Stage Layer of Learning DNA for this stage.
-- Holds { skill_graph, stage_error_stats, overall_mastery, strengths, weaknesses }.
CREATE TABLE IF NOT EXISTS student_stages (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    stage_id      VARCHAR(50) NOT NULL REFERENCES stages(id),
    status        VARCHAR(50) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'paused')),
    stage_profile JSONB NOT NULL DEFAULT '{}',
    activated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at  TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_student_stages_student ON student_stages(student_id);
CREATE INDEX IF NOT EXISTS idx_student_stages_stage   ON student_stages(stage_id, status);

DROP TRIGGER IF EXISTS update_student_stages_updated_at ON student_stages;
CREATE TRIGGER update_student_stages_updated_at
    BEFORE UPDATE ON student_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TESTS & QUESTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS tests (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title          VARCHAR(255) NOT NULL,
    description    TEXT,
    subject        VARCHAR(100) NOT NULL,
    grade_level    INTEGER NOT NULL,
    time_limit     INTEGER NOT NULL DEFAULT 1800,
    question_count INTEGER NOT NULL DEFAULT 35,
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_tests_updated_at ON tests;
CREATE TRIGGER update_tests_updated_at
    BEFORE UPDATE ON tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- stage_id: links a question to a stage (e.g. 'oc_prep').
-- Questions are a shared pool filtered by stage_id, not FK'd to specific tests.
CREATE TABLE IF NOT EXISTS questions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text          TEXT NOT NULL,
    type          VARCHAR(50) NOT NULL DEFAULT 'multiple_choice',
    options       JSONB,
    correct_answer TEXT,
    explanation   TEXT,
    difficulty    FLOAT DEFAULT 0.5 CHECK (difficulty >= 0 AND difficulty <= 1),
    estimated_time INTEGER DEFAULT 60,
    skill_tags    TEXT[] DEFAULT '{}',
    subject       VARCHAR(100),
    grade_level   INTEGER,
    stage_id      VARCHAR(50) DEFAULT NULL REFERENCES stages(id),
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questions_subject   ON questions(subject, grade_level);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_stage     ON questions(stage_id) WHERE stage_id IS NOT NULL;

-- ============================================================
-- TEST SESSIONS
-- ============================================================

-- student_stage_id: which Stage Layer enrollment this session belongs to.
-- contest_id: set when the session is part of a contest (FK added after contests table).
CREATE TABLE IF NOT EXISTS test_sessions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id          UUID REFERENCES tests(id),
    student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    student_stage_id UUID DEFAULT NULL REFERENCES student_stages(id),
    contest_id       UUID DEFAULT NULL,
    status           VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at       TIMESTAMP WITH TIME ZONE,
    completed_at     TIMESTAMP WITH TIME ZONE,
    time_remaining   INTEGER,
    estimated_ability FLOAT DEFAULT 0.0,
    scaled_score     FLOAT,
    raw_score        FLOAT,
    stage_id         VARCHAR(50) DEFAULT NULL REFERENCES stages(id),
    question_count   INTEGER DEFAULT 0,
    total_items      INTEGER DEFAULT 0,
    correct_count    INTEGER DEFAULT 0,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_test_sessions_student ON test_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_status  ON test_sessions(status);
CREATE INDEX IF NOT EXISTS idx_test_sessions_stage   ON test_sessions(student_stage_id)
    WHERE student_stage_id IS NOT NULL;

-- Session responses (per-question answers)
CREATE TABLE IF NOT EXISTS session_responses (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id     UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
    question_id    UUID NOT NULL REFERENCES questions(id),
    student_answer TEXT,
    is_correct     BOOLEAN,
    time_spent     INTEGER,
    answer_changes INTEGER DEFAULT 0,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_responses_session ON session_responses(session_id);

-- ============================================================
-- CHAT & CONVERSATIONS
-- ============================================================

-- stage_id: which stage context this chat session is operating in.
-- Determines which system prompt and which profile layer to inject.
CREATE TABLE IF NOT EXISTS chat_sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    role          VARCHAR(50) NOT NULL DEFAULT 'student_tutor',
    agent_state   VARCHAR(50) NOT NULL DEFAULT 'idle',
    turn_count    INTEGER NOT NULL DEFAULT 0,
    stage_id      VARCHAR(50) DEFAULT NULL REFERENCES stages(id),
    started_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE,
    metadata      JSONB
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_student ON chat_sessions(student_id, role);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_started ON chat_sessions(started_at);

CREATE TABLE IF NOT EXISTS chat_messages (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role      VARCHAR(50) NOT NULL,
    content   TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata  JSONB
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, timestamp);

CREATE TABLE IF NOT EXISTS conversation_memory (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id          UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    summary             TEXT NOT NULL,
    key_topics          TEXT[] DEFAULT '{}',
    insights_extracted  JSONB DEFAULT '{}',
    parent_questions    TEXT[] DEFAULT '{}',
    satisfaction_signal VARCHAR(50) DEFAULT NULL,
    turn_count          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversation_memory_student ON conversation_memory(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_session ON conversation_memory(session_id);

-- ============================================================
-- PROFILE ENGINE
-- ============================================================

-- student_profiles: kept for backward compatibility with v2 profile-engine handlers
-- during the transition period. The authoritative v3 Learning DNA is:
--   Core Layer  → students.core_profile
--   Stage Layer → student_stages.stage_profile
CREATE TABLE IF NOT EXISTS student_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      UUID UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    skill_graph     JSONB DEFAULT '[]'::jsonb,
    error_patterns  JSONB DEFAULT '[]'::jsonb,
    time_behavior   JSONB DEFAULT '{}'::jsonb,
    overall_mastery FLOAT DEFAULT 0.0,
    strengths       TEXT[] DEFAULT '{}',
    weaknesses      TEXT[] DEFAULT '{}',
    insights_json        JSONB DEFAULT NULL,
    last_insights_at     TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    stage_insights_json  JSONB DEFAULT '{}'::jsonb,
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_student ON student_profiles(student_id);

CREATE TABLE IF NOT EXISTS profile_snapshots (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    snapshot     JSONB NOT NULL,
    trigger      VARCHAR(100),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profile_snapshots_student ON profile_snapshots(student_id, created_at);

-- ============================================================
-- EVENTS (event sourcing)
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    stage_id   VARCHAR(50) DEFAULT NULL,
    payload    JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_student ON events(student_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_type    ON events(event_type, created_at);

-- ============================================================
-- SYSTEM CONFIG
-- ============================================================

CREATE TABLE IF NOT EXISTS system_config (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CONTEST SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS contest_series (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id        VARCHAR(50) NOT NULL REFERENCES stages(id),
    title           VARCHAR(255) NOT NULL,
    recurrence_rule VARCHAR(255) NOT NULL DEFAULT '',
    duration_mins   INTEGER NOT NULL DEFAULT 30,
    question_count  INTEGER NOT NULL DEFAULT 35,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contest_series_stage ON contest_series(stage_id);

-- status lifecycle: draft → open → active → scoring → finalized
CREATE TABLE IF NOT EXISTS contests (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_id          UUID DEFAULT NULL REFERENCES contest_series(id),
    stage_id           VARCHAR(50) NOT NULL REFERENCES stages(id),
    title              VARCHAR(255) NOT NULL,
    status             VARCHAR(50) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'open', 'active', 'scoring', 'finalized')),
    question_ids       UUID[] DEFAULT '{}',
    window_start_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    total_participants INTEGER DEFAULT 0,
    avg_score          FLOAT DEFAULT NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contests_stage_status ON contests(stage_id, status);
CREATE INDEX IF NOT EXISTS idx_contests_window       ON contests(window_start_at);

DROP TRIGGER IF EXISTS update_contests_updated_at ON contests;
CREATE TRIGGER update_contests_updated_at
    BEFORE UPDATE ON contests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS contest_registrations (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contest_id   UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contest_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_registrations_contest ON contest_registrations(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_registrations_student ON contest_registrations(student_id);

CREATE TABLE IF NOT EXISTS contest_results (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id UUID NOT NULL UNIQUE REFERENCES test_sessions(id),
    score      INTEGER NOT NULL,
    rank       INTEGER NOT NULL,
    percentile FLOAT NOT NULL,
    scored_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contest_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_results_contest ON contest_results(contest_id, rank);
CREATE INDEX IF NOT EXISTS idx_contest_results_student ON contest_results(student_id);

-- Add the contest_id FK to test_sessions now that contests table exists
ALTER TABLE test_sessions
    ADD CONSTRAINT fk_test_sessions_contest
    FOREIGN KEY (contest_id) REFERENCES contests(id);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Stage definitions
INSERT INTO stages (id, display_name, test_formats, sort_order, is_active)
VALUES
    ('oc_prep',   'OC Preparation',       '{"practice":{"question_count":35,"time_limit_seconds":1800}}', 1, true),
    ('selective', 'Selective High School', '{"practice":{"question_count":35,"time_limit_seconds":2400}}', 2, true),
    ('hsc',       'HSC Preparation',       '{"practice":{"question_count":35,"time_limit_seconds":2700}}', 3, true),
    ('lifelong',  'University & Beyond',   '{"practice":{"question_count":35,"time_limit_seconds":2700}}', 4, true)
ON CONFLICT (id) DO NOTHING;

-- OC skill taxonomy v1
INSERT INTO skill_taxonomies (stage_id, version, categories)
VALUES (
    'oc_prep',
    'v1',
    '{
        "reading": {
            "label": "Reading",
            "skills": {
                "inference":       {"label": "Inference",          "weight": 1.0},
                "vocabulary":      {"label": "Vocabulary",         "weight": 1.0},
                "main_idea":       {"label": "Main Idea",          "weight": 1.0},
                "text_structure":  {"label": "Text Structure",     "weight": 0.8},
                "author_purpose":  {"label": "Author Purpose",     "weight": 0.8}
            }
        },
        "mathematical_reasoning": {
            "label": "Mathematical Reasoning",
            "skills": {
                "number_patterns":     {"label": "Number Patterns",      "weight": 1.0},
                "arithmetic":          {"label": "Arithmetic",           "weight": 1.0},
                "fractions_decimals":  {"label": "Fractions & Decimals", "weight": 1.0},
                "geometry":            {"label": "Geometry",             "weight": 0.9},
                "word_problems":       {"label": "Word Problems",        "weight": 1.0},
                "data_interpretation": {"label": "Data Interpretation",  "weight": 0.8}
            }
        },
        "thinking_skills": {
            "label": "Thinking Skills",
            "skills": {
                "logical_reasoning":   {"label": "Logical Reasoning",   "weight": 1.0},
                "analogies":           {"label": "Analogies",           "weight": 0.9},
                "spatial_reasoning":   {"label": "Spatial Reasoning",   "weight": 0.9},
                "pattern_recognition": {"label": "Pattern Recognition", "weight": 1.0},
                "verbal_reasoning":    {"label": "Verbal Reasoning",    "weight": 0.9}
            }
        },
        "writing": {
            "label": "Writing",
            "skills": {
                "narrative":     {"label": "Narrative Writing",       "weight": 1.0},
                "persuasive":    {"label": "Persuasive Writing",      "weight": 1.0},
                "structure":     {"label": "Structure & Organisation", "weight": 0.9},
                "vocabulary_use":{"label": "Vocabulary Use",          "weight": 0.8},
                "grammar":       {"label": "Grammar & Punctuation",   "weight": 0.8}
            }
        }
    }'
) ON CONFLICT (stage_id, version) DO NOTHING;

-- Initial admin user (replace password_hash before first use)
INSERT INTO users (email, name, role, password_hash)
VALUES (
    'admin@edulens.com',
    'Admin User',
    'admin',
    '$2a$10$placeholder'
) ON CONFLICT (email) DO NOTHING;

-- Remove any model ID overrides from system_config so they always fall back to
-- the BEDROCK_MODEL_ID Lambda environment variable, which CDK sets per-region:
--   ap-* → anthropic.claude-3-5-sonnet-20241022-v2:0
--   eu-* → eu.anthropic.claude-sonnet-4-20250514-v1:0
--   us-* → us.anthropic.claude-sonnet-4-20250514-v1:0
-- This prevents stale values surviving a cross-region migration.
DELETE FROM system_config
WHERE key IN ('aiInsightsModelId', 'aiParentChatModelId', 'aiStudentChatModelId', 'aiSummarizationModelId');
